import { isUser } from '@/features/groups/people/is-user';
import { memberBalances } from '@core/groups/balance';

import type { SharedEntry } from '@core/groups/shared-entry';
import type { SharedGroup } from '@core/groups/shared-group';

// Whether the device sees nothing in the way of deleting a group: every balance at zero, or no user but the person still
// in it, as a group of placeholders hurts nobody. A member with no name deleted their account and is no user. The
// server decides.
const mayDelete = (group: SharedGroup, entries: readonly SharedEntry[]): boolean => {
    const others = group.members.some((member) => member.id !== group.me && isUser(member) && member.leftAt === null);
    return !others || memberBalances(entries, group.members).every((balance) => balance.cents === 0);
};

export { mayDelete };
