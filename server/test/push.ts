import { readVapidKey } from '@server/vapid';

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

export { testVapidKey };
