import { fromBase64Url, toBase64Url } from '@server/base64url';

import type { VapidKey } from '@server/vapid';

// A subscription of a browser: its address and its keys, base64url
interface PushTarget {
    endpoint: string;
    p256dh: string;
    auth: string;
}

// What the answer of a push service means for the subscription
type PushResult = 'sent' | 'gone' | 'failed';

// How long a push service keeps a message for a device that is off, in seconds
const TTL_SECONDS = 86_400;

// How long the signature of a push is good for, in seconds (RFC 8292 caps it at a day)
const JWT_SECONDS = 43_200;

// The size of a record: the whole message fits in one
const RECORD_SIZE = 4096;

const encoder = new TextEncoder();

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
};

const hmac = async (key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> => {
    const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
};

// The `info` of the last step of HKDF, with the counter of its one block
const info = (label: string) => concat(encoder.encode(`Content-Encoding: ${label}`), new Uint8Array([0, 1]));

const newLocalKeys = async (): Promise<CryptoKeyPair> => {
    return (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
        'deriveBits',
    ])) as CryptoKeyPair;
};

// The shared secret of two P-256 keys. The types of the Workers call the key `$public`, which the runtime reads as
// `public`.
const ecdhSecret = async (privateKey: CryptoKey, publicPoint: Uint8Array<ArrayBuffer>) => {
    const other = await crypto.subtle.importKey('raw', publicPoint, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const algorithm = { name: 'ECDH', public: other } as unknown as SubtleCryptoDeriveKeyAlgorithm;
    return new Uint8Array(await crypto.subtle.deriveBits(algorithm, privateKey, 256));
};

// The key and the nonce of the content (RFC 8291, section 3.4), from the secret both sides share
const contentKeys = async (
    shared: Uint8Array<ArrayBuffer>,
    auth: Uint8Array<ArrayBuffer>,
    uaPublic: Uint8Array<ArrayBuffer>,
    asPublic: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>
) => {
    const prkKey = await hmac(auth, shared);
    const keyInfo = concat(
        encoder.encode('WebPush: info'),
        new Uint8Array([0]),
        uaPublic,
        asPublic,
        new Uint8Array([1])
    );
    const prk = await hmac(salt, await hmac(prkKey, keyInfo));
    return {
        cek: (await hmac(prk, info('aes128gcm'))).slice(0, 16),
        nonce: (await hmac(prk, info('nonce'))).slice(0, 12),
    };
};

// The body of a push for one subscription, `aes128gcm` (RFC 8291): a key pair and a salt of its own each time, unless the
// test of the RFC's example fixes them
const encryptPayload = async (
    target: PushTarget,
    plaintext: Uint8Array,
    fixed?: { salt: Uint8Array<ArrayBuffer>; localKeys: CryptoKeyPair }
): Promise<Uint8Array<ArrayBuffer>> => {
    const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
    const local = fixed?.localKeys ?? (await newLocalKeys());
    const uaPublic = fromBase64Url(target.p256dh);
    const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer);
    const shared = await ecdhSecret(local.privateKey, uaPublic);
    const { cek, nonce } = await contentKeys(shared, fromBase64Url(target.auth), uaPublic, asPublic, salt);

    const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const record = concat(plaintext, new Uint8Array([2]));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0, RECORD_SIZE);
    return concat(salt, size, new Uint8Array([asPublic.length]), asPublic, ciphertext);
};

const jsonPart = (value: object) => toBase64Url(encoder.encode(JSON.stringify(value)));

// The header that tells the push service who sends it (RFC 8292): a JWT for the origin of the address, signed with the
// key of the server, and its public key
const vapidAuthorization = async (endpoint: string, key: VapidKey, subject: string, now: number): Promise<string> => {
    const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + JWT_SECONDS, sub: subject };
    const unsigned = `${jsonPart({ typ: 'JWT', alg: 'ES256' })}.${jsonPart(claims)}`;
    const signer = await crypto.subtle.importKey('jwk', key.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'sign',
    ]);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, encoder.encode(unsigned));
    return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${key.publicKey}`;
};

// Sends one message to one subscription. A push is a hint: the next sync brings the entry anyway, so nothing is retried.
const sendPush = async (target: PushTarget, message: unknown, key: VapidKey, subject: string): Promise<PushResult> => {
    try {
        const body = await encryptPayload(target, encoder.encode(JSON.stringify(message)));
        const response = await fetch(target.endpoint, {
            method: 'POST',
            headers: {
                Authorization: await vapidAuthorization(target.endpoint, key, subject, Date.now()),
                'Content-Encoding': 'aes128gcm',
                'Content-Type': 'application/octet-stream',
                TTL: String(TTL_SECONDS),
                Urgency: 'normal',
            },
            body,
        });
        if (response.status === 404 || response.status === 410) return 'gone';
        return response.ok ? 'sent' : 'failed';
    } catch {
        return 'failed';
    }
};

export { contentKeys, ecdhSecret, encryptPayload, sendPush, vapidAuthorization, type PushResult, type PushTarget };
