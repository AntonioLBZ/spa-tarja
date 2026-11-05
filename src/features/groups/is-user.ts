import type { GroupMember } from '@core/shared-group';

// Whether the member is a person who uses the app: one who has joined and kept their account, as one who deleted it
// has no name left. Whether they are still in the group is another question.
const isUser = (member: GroupMember): boolean => {
    return member.claimed && member.name !== '';
};

export { isUser };
