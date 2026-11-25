import { memberBalances } from '@core/groups/balance';

import type { SharedEntry } from '@core/groups/shared-entry';
import type { SharedGroup } from '@core/groups/shared-group';

// What the person is owed in a group, positive, or owes, negative
const myBalance = (group: SharedGroup, entries: readonly SharedEntry[]): number => {
    return memberBalances(entries, group.members).find((balance) => balance.memberId === group.me)?.cents ?? 0;
};

export { myBalance };
