import { canonicalMember, type SharedMember } from './shared-member';

import type { LedgerEntry } from './shared-entry';

// A new entry of a group told to one of its members (ADR-0025)
type Notice =
    | {
          kind: 'expense';
          groupId: string;
          entryId: string;
          // Who made it, null once they deleted their account
          authorId: string | null;
          text: string;
          currency: string;
          // What the member owes of it
          partCents: number;
      }
    | {
          kind: 'settlement';
          groupId: string;
          entryId: string;
          // The other side of the settlement
          counterpartId: string;
          currency: string;
          amountCents: number;
          side: 'paid-you' | 'you-paid';
      };

// The group a pull is about, as the device holds it
interface NoticeGroup {
    id: string;
    me: string;
    members: readonly SharedMember[];
}

// What an entry tells a member: nothing when it is deleted or theirs, or when it is an expense without a share of
// theirs or a settlement they are not a side of
const noticeOf = (
    members: readonly SharedMember[],
    groupId: string,
    entry: LedgerEntry,
    memberId: string
): Notice | null => {
    const isThem = (id: string) => canonicalMember(members, id) === memberId;
    if (entry.deletedAt !== null || (entry.createdBy !== null && isThem(entry.createdBy))) return null;

    if (entry.kind === 'settlement') {
        const [share] = entry.shares;
        if (!share) return null;
        const paid = isThem(entry.paidBy);
        if (!paid && !isThem(share.memberId)) return null;
        return {
            kind: 'settlement',
            groupId,
            entryId: entry.id,
            counterpartId: canonicalMember(members, paid ? share.memberId : entry.paidBy),
            currency: entry.currency,
            amountCents: entry.amountCents,
            side: paid ? 'you-paid' : 'paid-you',
        };
    }

    const partCents = entry.shares
        .filter((share) => isThem(share.memberId))
        .reduce((sum, share) => sum + share.cents, 0);
    if (partCents === 0) return null;
    return {
        kind: 'expense',
        groupId,
        entryId: entry.id,
        authorId: entry.createdBy,
        text: entry.text,
        currency: entry.currency,
        partCents,
    };
};

// What a pull tells the person: the entries it brought that the device didn't hold. A first pull, `held` undefined,
// tells nothing, as it brings the whole history.
const noticesFor = (
    group: NoticeGroup,
    held: readonly LedgerEntry[] | undefined,
    pulled: readonly LedgerEntry[]
): Notice[] => {
    if (!held) return [];
    const known = new Set(held.map((entry) => entry.id));
    return pulled.flatMap((entry) => {
        if (known.has(entry.id)) return [];
        const notice = noticeOf(group.members, group.id, entry, group.me);
        return notice ? [notice] : [];
    });
};

export { noticeOf, noticesFor, type Notice, type NoticeGroup };
