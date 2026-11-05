import * as v from 'valibot';

// How long the link of an invitation can be used
const INVITATION_DAYS = 14;

// The id of the invitation, a UUID, and a signature of it in base64url: 32 bytes, whose last character carries only 4
// bits, so only the 16 characters that end in two zero bits spell it; one invitation has one link
const TOKEN_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[\w-]{42}[AEIMQUYcgkosw048]$/;

const isInvitationToken = (token: string): boolean => {
    return TOKEN_SHAPE.test(token);
};

// The body of the routes that take a link. Its shape is checked when it is read, so that a token of another shape gets
// the same refusal as one that doesn't exist.
const invitationTokenSchema = v.object({ token: v.pipe(v.string(), v.maxLength(200)) });

// The latest invitation of a friend as its members see it: open, with the token of its link, or declined
type FriendInvitation = { state: 'open'; token: string; expiresAt: number } | { state: 'declined' };

// What a link shows the person who opens it: the name of who asks, and nothing else
interface InvitationView {
    name: string;
}

export { INVITATION_DAYS, invitationTokenSchema, isInvitationToken, type FriendInvitation, type InvitationView };
