import * as v from 'valibot';

// How long the link of an invitation can be used
const INVITATION_DAYS = 14;

// How long a direct invitation that ended without being accepted stays in the table, after which making a link deletes it
const ENDED_INVITATION_DAYS = 30;

// The id of the invitation, a UUID, and a signature of it in base64url: 32 bytes, whose last character carries only 4
// bits, so only the 16 characters that end in two zero bits spell it; one invitation has one link
const TOKEN_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[\w-]{42}[AEIMQUYcgkosw048]$/;

const isInvitationToken = (token: string): boolean => {
    return TOKEN_SHAPE.test(token);
};

// The body of the routes that take a link. Only that it holds a token key is checked here: what the token is, its type,
// shape and length, is checked when it is read, so that any token that is not a link gets the same refusal as one that
// doesn't exist.
const invitationTokenSchema = v.object({ token: v.unknown() });

// In lower case, as the server makes them
const invitationIdSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase());

// A direct invitation of the person's that is still open, with the token of its link, so it can be copied again
interface PendingInvitation {
    id: string;
    token: string;
    expiresAt: number;
}

// What a link shows the person who opens it: the name of who asks, and nothing else
interface InvitationView {
    name: string;
}

export {
    ENDED_INVITATION_DAYS,
    INVITATION_DAYS,
    invitationIdSchema,
    invitationTokenSchema,
    isInvitationToken,
    type InvitationView,
    type PendingInvitation,
};
