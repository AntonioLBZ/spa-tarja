import { canonicalMember } from '@core/shared-member';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// Whether an entry names somebody who left the group, as its payer or in a share, a merged placeholder read as its
// target: the device doesn't offer to edit it, as an edit may not move what that person pays or owes
const namesSomeoneWhoLeft = (entry: SharedEntry, group: SharedGroup): boolean => {
    const left = (memberId: string) => {
        const id = canonicalMember(group.members, memberId);
        return group.members.some((member) => member.id === id && member.leftAt !== null);
    };
    return left(entry.paidBy) || entry.shares.some((share) => left(share.memberId));
};

export { namesSomeoneWhoLeft };
