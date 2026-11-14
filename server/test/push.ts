import { toBase64Url } from '@server/base64url';
import { readVapidKey } from '@server/vapid';
import { contentKeys, ecdhSecret } from '@server/web-push';

// A key of the server made for a test, as the secret holds it, and its public key
const testVapidKey = async (): Promise<{ jwk: string; publicKey: string }> => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
        'sign',
        'verify',
    ])) as CryptoKeyPair;
    const { kty, crv, x, y, d } = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
    const jwk = JSON.stringify({ kty, crv, x, y, d });
    const key = readVapidKey(jwk);
    if (!key) throw new Error('The test key could not be read');
    return { jwk, publicKey: key.publicKey };
};

interface TestBrowser {
    // What the device sends to `PUT /api/push`
    subscription: { endpoint: string; keys: { p256dh: string; auth: string }; locale: 'en' | 'es' };
    // Reads a body the server sent it, as the browser does
    decrypt: (body: Uint8Array<ArrayBuffer>) => Promise<unknown>;
}

// A browser subscribed to push, with keys of its own, that can read what is sent to it
const testBrowser = async (locale: 'en' | 'es' = 'en'): Promise<TestBrowser> => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
        'deriveBits',
    ])) as CryptoKeyPair;
    const uaPublic = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;

    const decrypt = async (body: Uint8Array<ArrayBuffer>) => {
        const salt = body.slice(0, 16);
        const asPublic = body.slice(21, 21 + body[20]!);
        const shared = await ecdhSecret(pair.privateKey, asPublic);
        const { cek, nonce } = await contentKeys(shared, auth, uaPublic, asPublic, salt);
        const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
        const ciphertext = body.slice(21 + asPublic.length);
        const record = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ciphertext));
        return JSON.parse(new TextDecoder().decode(record.slice(0, record.lastIndexOf(2))));
    };

    return {
        subscription: { endpoint, keys: { p256dh: toBase64Url(uaPublic), auth: toBase64Url(auth) }, locale },
        decrypt,
    };
};

export { testBrowser, testVapidKey, type TestBrowser };
