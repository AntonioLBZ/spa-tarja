import { isInvitationToken } from '@core/invitation';

const JOIN = '/join/';

// The path of the link of an invitation, which the sign-in comes back to; null for any other path, so that nothing but
// a link of that exact shape is ever sent as the way back
const invitationPath = (pathname: string): string | null => {
    return pathname.startsWith(JOIN) && isInvitationToken(pathname.slice(JOIN.length)) ? pathname : null;
};

export { invitationPath };
