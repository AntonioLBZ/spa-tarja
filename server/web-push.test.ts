import { afterEach, describe, expect, it, vi } from 'vitest';

import { fromBase64Url, toBase64Url } from '@server/base64url';
import { testVapidKey } from '@server/test/push';
import { readVapidKey } from '@server/vapid';

import { encryptPayload, sendPush, vapidAuthorization } from './web-push';

const RFC = {
    plaintext: 'When I grow up, I want to be a watermelon',
    asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
    salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    body:
        'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl' +
        '7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function rfcLocalKeys(): Promise<CryptoKeyPair> {
    const point = fromBase64Url(RFC.asPublic);
    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x: toBase64Url(point.slice(1, 33)),
        y: toBase64Url(point.slice(33, 65)),
        d: RFC.asPrivate,
    };
    const algorithm = { name: 'ECDH', namedCurve: 'P-256' };
    const privateKey = await crypto.subtle.importKey('jwk', jwk, algorithm, true, ['deriveBits']);
    const publicKey = await crypto.subtle.importKey('raw', point, algorithm, true, []);
    return { privateKey, publicKey };
}

const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: RFC.uaPublic, auth: RFC.authSecret };

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('encryptPayload', () => {
    it('gives the body of the example of RFC 8291 for its keys and its salt', async () => {
        const body = await encryptPayload(target, new TextEncoder().encode(RFC.plaintext), {
            salt: fromBase64Url(RFC.salt),
            localKeys: await rfcLocalKeys(),
        });

        expect(toBase64Url(body)).toBe(RFC.body);
    });

    it('uses a new salt and a new key for every message', async () => {
        const plaintext = new TextEncoder().encode(RFC.plaintext);
        const [a, b] = await Promise.all([encryptPayload(target, plaintext), encryptPayload(target, plaintext)]);

        expect(toBase64Url(a.slice(0, 16))).not.toBe(toBase64Url(b.slice(0, 16)));
        expect(toBase64Url(a.slice(21, 86))).not.toBe(toBase64Url(b.slice(21, 86)));
    });
});

describe('vapidAuthorization', () => {
    it('signs, with the key of the server, who it is for, until when and who sends it', async () => {
        const { jwk } = await testVapidKey();
        const key = readVapidKey(jwk)!;
        const now = Date.UTC(2026, 10, 14, 12);

        const header = await vapidAuthorization(target.endpoint, key, 'mailto:ana@example.com', now);

        const [, token = '', k = ''] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? [];
        expect(k).toBe(key.publicKey);
        const [head = '', claims = '', signature = ''] = token.split('.');
        expect(JSON.parse(new TextDecoder().decode(fromBase64Url(head)))).toEqual({ typ: 'JWT', alg: 'ES256' });
        expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims)))).toEqual({
            aud: 'https://fcm.googleapis.com',
            exp: now / 1000 + 43_200,
            sub: 'mailto:ana@example.com',
        });
        const publicKey = await crypto.subtle.importKey(
            'raw',
            fromBase64Url(key.publicKey),
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
        );
        const signed = new TextEncoder().encode(`${head}.${claims}`);
        expect(
            await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, fromBase64Url(signature), signed)
        ).toBe(true);
    });
});

describe('sendPush', () => {
    async function sendWith(answer: () => Promise<Response>) {
        const fetchMock = vi.fn(answer);
        vi.stubGlobal('fetch', fetchMock);
        const { jwk } = await testVapidKey();
        const result = await sendPush(target, { hello: 'there' }, readVapidKey(jwk)!, 'mailto:ana@example.com');
        return { result, fetchMock };
    }

    it('posts the encrypted message for a day, with a normal urgency', async () => {
        const { result, fetchMock } = await sendWith(async () => new Response(null, { status: 201 }));

        expect(result).toBe('sent');
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(target.endpoint);
        const headers = new Headers(init.headers);
        expect(init.method).toBe('POST');
        expect(init.redirect).toBe('manual');
        expect(headers.get('TTL')).toBe('86400');
        expect(headers.get('Urgency')).toBe('normal');
        expect(headers.get('Content-Encoding')).toBe('aes128gcm');
        expect(headers.get('Authorization')).toMatch(/^vapid t=/);
    });

    it.each([404, 410])('says the subscription is gone when the service answers %i', async (status) => {
        expect((await sendWith(async () => new Response(null, { status }))).result).toBe('gone');
    });

    it('says it failed on any other answer, a redirect included, and when the request fails', async () => {
        expect((await sendWith(async () => new Response(null, { status: 500 }))).result).toBe('failed');
        expect(
            (
                await sendWith(
                    async () => new Response(null, { status: 301, headers: { location: 'https://evil.test' } })
                )
            ).result
        ).toBe('failed');
        expect((await sendWith(async () => Promise.reject(new TypeError('Failed to fetch')))).result).toBe('failed');
    });
});
