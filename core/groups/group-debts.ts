import { memberBalances, pairwiseDebts, type Debt } from './balance';
import { simplifyDebts } from './simplify';

import type { SharedEntry } from './shared-entry';
import type { SharedMember } from './shared-member';

// The debts a group shows: who owes whom pair by pair, or the fewest payments when the group is simplified. Either is a
// way to read the same balances, so what each member is owed or owes is the same in both.
const groupDebts = (entries: readonly SharedEntry[], members: readonly SharedMember[], simplified: boolean): Debt[] => {
    return simplified ? simplifyDebts(memberBalances(entries, members)) : pairwiseDebts(entries, members);
};

export { groupDebts };
