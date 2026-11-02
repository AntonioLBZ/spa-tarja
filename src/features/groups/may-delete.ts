import { memberBalances } from '@core/balance';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// Whether the device sees nothing in the way of deleting a group: every balance at zero, or no user but the person still
// in it, as a group of placeholders hurts nobody. A member with no name deleted their account and is no user. The
// server decides.
const mayDelete = (group: SharedGroup, entries: readonly SharedEntry[]): boolean => {
    const others = group.members.some(
        (member) => member.id !== group.me && member.claimed && member.name !== '' && member.leftAt === null
    );
    return !others || memberBalances(entries, group.members).every((balance) => balance.cents === 0);
};

export { mayDelete };
