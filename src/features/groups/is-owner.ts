import type { SharedGroup } from '@core/shared-group';

// Whether the person may do what only the owner does: the owner of a group, or either side of a friend, which has
// nothing to hand over. The screen only hides what they can't do; the server decides on every call.
const isOwner = (group: SharedGroup): boolean => {
    return group.kind === 'direct' || group.members.some((member) => member.id === group.me && member.role === 'owner');
};

export { isOwner };
