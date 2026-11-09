import { describe, expect, it } from 'vitest';

import { memberBalances, pairwiseDebts, type Debt } from './balance';
import { groupDebts } from './group-debts';
import { simplifyDebts } from './simplify';
import { seededRandom } from './test/random';
import { mergeMember, randomGroup } from './test/random-group';

import type { SharedEntry } from './shared-entry';
import type { SharedMember } from './shared-member';

const GROUPS = 500;

const members: SharedMember[] = [
    { id: 'ana', mergedInto: null },
    { id: 'bruno', mergedInto: null },
    { id: 'carla', mergedInto: null },
];

function expense(id: string, paidBy: string, shares: Record<string, number>): SharedEntry {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        id,
        kind: 'expense',
        text: id,
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-10-25',
        paidBy,
        split: 'exact',
        shares: list,
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
    };
}

function netOf(debts: readonly Debt[]) {
    const net = new Map<string, number>();
    for (const { from, to, cents } of debts) {
        net.set(from, (net.get(from) ?? 0) - cents);
        net.set(to, (net.get(to) ?? 0) + cents);
    }
    return net;
}

describe('groupDebts', () => {
    const entries = [
        expense('dinner', 'ana', { ana: 1000, bruno: 1000 }),
        expense('taxi', 'bruno', { bruno: 500, carla: 500 }),
    ];

    it('is who owes whom, pair by pair, while the debts are not simplified', () => {
        expect(groupDebts(entries, members, false)).toEqual(pairwiseDebts(entries, members));
        expect(groupDebts(entries, members, false)).toEqual([
            { from: 'bruno', to: 'ana', cents: 1000 },
            { from: 'carla', to: 'bruno', cents: 500 },
        ]);
    });

    it('is the fewest payments once they are', () => {
        expect(groupDebts(entries, members, true)).toEqual(simplifyDebts(memberBalances(entries, members)));
        expect(groupDebts(entries, members, true)).toEqual([
            { from: 'bruno', to: 'ana', cents: 500 },
            { from: 'carla', to: 'ana', cents: 500 },
        ]);
    });

    it('routes around a member whose balance is zero, as one who left is', () => {
        const chain = [expense('dinner', 'ana', { bruno: 1000 }), expense('taxi', 'bruno', { carla: 1000 })];

        expect(groupDebts(chain, members, false)).toEqual([
            { from: 'bruno', to: 'ana', cents: 1000 },
            { from: 'carla', to: 'bruno', cents: 1000 },
        ]);
        expect(groupDebts(chain, members, true)).toEqual([{ from: 'carla', to: 'ana', cents: 1000 }]);
    });

    it('splits odd cents the way the balances do, without losing one', () => {
        const odd = [expense('lunch', 'ana', { ana: 334, bruno: 333, carla: 333 })];

        expect(groupDebts(odd, members, true)).toEqual([
            { from: 'bruno', to: 'ana', cents: 333 },
            { from: 'carla', to: 'ana', cents: 333 },
        ]);
    });

    it('has the same net for every member in both views, which is their balance, whatever the merges', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const group = randomGroup(random);
            const people = random.chance(0.3)
                ? mergeMember(group.members, random.pick(group.members.slice(1)).id, group.members[0]!.id)
                : group.members;

            const pairs = netOf(groupDebts(group.entries, people, false));
            const simplified = netOf(groupDebts(group.entries, people, true));

            for (const { memberId, cents } of memberBalances(group.entries, people)) {
                expect(pairs.get(memberId) ?? 0, `seed ${seed}`).toBe(cents);
                expect(simplified.get(memberId) ?? 0, `seed ${seed}`).toBe(cents);
            }
        }
    });
});
