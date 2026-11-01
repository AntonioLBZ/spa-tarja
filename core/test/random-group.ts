import { DEFAULT_CATEGORY_IDS } from '@core/categories';
import { addMonths } from '@core/date';
import { PAYMENTS } from '@core/expense';
import { SPLIT_MODES, type Share, type SharedEntry, type SplitMode } from '@core/shared-entry';
import { HUNDRED_PERCENT, splitByPercent, splitEqually, splitExactly } from '@core/split';

import { memberIdOf, type Random } from './random';

import type { SharedMember } from '@core/shared-member';

interface RandomGroup {
    members: SharedMember[];
    entries: SharedEntry[];
}

const randomSplit = (random: Random, amountCents: number, memberIds: readonly string[]): [SplitMode, Share[]] => {
    const split = random.pick(SPLIT_MODES);
    if (split === 'equal') return [split, splitEqually(amountCents, memberIds) ?? []];
    if (split === 'percent') {
        const basisPoints = random.parts(HUNDRED_PERCENT, memberIds.length);
        const percents = memberIds.map((memberId, index) => ({ memberId, basisPoints: basisPoints[index]! }));
        return [split, splitByPercent(amountCents, percents) ?? []];
    }
    const cents = random.parts(amountCents, memberIds.length);
    const parts = memberIds.map((memberId, index) => ({ memberId, cents: cents[index]! }));
    return [split, splitExactly(amountCents, parts) ?? []];
};

const randomEntry = (random: Random, index: number, memberIds: readonly string[]): SharedEntry => {
    const date = `2026-${random.pick(['09', '10', '11', '12'])}-${String(random.int(1, 28)).padStart(2, '0')}`;
    const amountCents = random.int(1, random.pick([100, 10_000, 1_000_000]));
    const paidBy = random.pick(memberIds);
    const entry = {
        id: `entry-${index}`,
        text: `Entry ${index}`,
        amountCents,
        currency: 'EUR',
        date,
        paidBy,
        createdAt: index,
        updatedAt: index,
        deletedAt: random.chance(0.1) ? index : null,
    };

    if (random.chance(0.2)) {
        const receiver = random.pick(memberIds.filter((memberId) => memberId !== paidBy));
        return {
            ...entry,
            kind: 'settlement',
            categoryId: null,
            split: 'exact',
            shares: [{ memberId: receiver, cents: amountCents }],
            payment: 'direct',
            chargeDate: null,
        };
    }

    const chosen = memberIds.filter(() => random.chance(0.7));
    const [split, shares] = randomSplit(random, amountCents, chosen.length > 0 ? chosen : [paidBy]);
    const payment = shares.some((share) => share.memberId === paidBy) ? random.pick(PAYMENTS) : 'direct';
    return {
        ...entry,
        kind: 'expense',
        categoryId: random.pick(DEFAULT_CATEGORY_IDS),
        split,
        shares,
        payment,
        chargeDate: payment === 'direct' ? null : addMonths(date, random.int(0, 1)),
    };
};

// A group of two to eight members, none merged, and up to forty entries of every kind, some deleted
const randomGroup = (random: Random): RandomGroup => {
    const memberIds = Array.from({ length: random.int(2, 8) }, (_, index) => memberIdOf(index));
    return {
        members: memberIds.map((id) => ({ id, mergedInto: null })),
        entries: Array.from({ length: random.int(0, 40) }, (_, index) => randomEntry(random, index, memberIds)),
    };
};

// The members once one of them is merged into another
const mergeMember = (members: readonly SharedMember[], placeholder: string, into: string): SharedMember[] => {
    return members.map((member) => (member.id === placeholder ? { ...member, mergedInto: into } : member));
};

export { mergeMember, randomGroup, type RandomGroup };
