import * as v from 'valibot';

import { fromBase64Url, toBase64Url } from '@server/base64url';

// The private key the server signs pushes with (RFC 8292), kept as a JWK in one secret, so the public key is read from
// it and can't drift from it
const vapidJwkSchema = v.object({
    kty: v.literal('EC'),
    crv: v.literal('P-256'),
    x: v.pipe(v.string(), v.regex(/^[\w-]{43}$/)),
    y: v.pipe(v.string(), v.regex(/^[\w-]{43}$/)),
    d: v.pipe(v.string(), v.regex(/^[\w-]{43}$/)),
});

type VapidJwk = v.InferOutput<typeof vapidJwkSchema>;

interface VapidKey {
    jwk: VapidJwk;
    // The uncompressed point, base64url, as a browser subscribes with it and the `k` of the header names it
    publicKey: string;
}

// The key in the secret, or null when there is none or it can't be read
const readVapidKey = (secret: string | undefined): VapidKey | null => {
    if (!secret) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(secret);
    } catch {
        return null;
    }
    const result = v.safeParse(vapidJwkSchema, parsed);
    if (!result.success) return null;
    const jwk = result.output;
    const point = new Uint8Array([4, ...fromBase64Url(jwk.x), ...fromBase64Url(jwk.y)]);
    return { jwk, publicKey: toBase64Url(point) };
};

export { readVapidKey, type VapidJwk, type VapidKey };
