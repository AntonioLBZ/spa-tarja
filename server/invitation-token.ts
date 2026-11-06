import { isInvitationToken } from '@core/invitation';

const encoder = new TextEncoder();

// What is signed: the id under a name of its own, so that no other signature made with the same secret passes for one
const message = (id: string) => encoder.encode(`friend-invitation:${id}`);

const hmacKey = (secret: string) => {
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
    ]);
};

const toBase64Url = (bytes: ArrayBuffer): string => {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

// The token of the link of an invitation: its id and a signature of it, which the database never holds, so that the
// table alone opens no link
const signInvitation = async (secret: string, id: string): Promise<string> => {
    const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), message(id));
    return `${id}.${toBase64Url(signature)}`;
};

// The id of the invitation a token names, or null when the server didn't sign it
const readInvitationToken = async (secret: string, token: string): Promise<string | null> => {
    if (!isInvitationToken(token)) return null;
    const [id = '', signature = ''] = token.split('.');
    const signed = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64Url(signature), message(id));
    return signed ? id : null;
};

export { readInvitationToken, signInvitation };
