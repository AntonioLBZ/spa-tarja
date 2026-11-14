import { isInvitationToken } from '@core/invitation';
import { fromBase64Url, toBase64Url } from '@server/base64url';

const encoder = new TextEncoder();

// What is signed: the id under a name of its own, so that no other signature made with the same secret passes for one
const message = (id: string) => encoder.encode(`friend-invitation:${id}`);

const hmacKey = (secret: string) => {
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
    ]);
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
