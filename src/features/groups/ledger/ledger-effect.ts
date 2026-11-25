import { yourPart } from '@core/groups/shared-expense';
import { canonicalMember } from '@core/groups/shared-member';

import type { SharedEntry } from '@core/groups/shared-entry';
import type { SharedGroup } from '@core/groups/shared-group';

// How an entry touches the person: it moves their balance, or it is theirs alone, or they aren't in it
type LedgerTouch = 'moves' | 'justYou' | 'notIn';

interface LedgerEffect {
    paidByMe: boolean;
    // The person's share
    part: number;
    // What it does to their balance in the group, as the balances add it up: whoever paid is credited the whole and
    // every share is debited, a settlement too (ADR-0030)
    cents: number;
    touch: LedgerTouch;
}

const ledgerEffect = (entry: SharedEntry, group: SharedGroup): LedgerEffect => {
    const paidByMe = canonicalMember(group.members, entry.paidBy) === group.me;
    const part = yourPart(entry, group.me, group.members);
    const cents = (paidByMe ? entry.amountCents : 0) - part;
    const touch = cents !== 0 ? 'moves' : paidByMe ? 'justYou' : 'notIn';
    return { paidByMe, part, cents, touch };
};

export { ledgerEffect, type LedgerEffect, type LedgerTouch };
