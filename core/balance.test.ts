import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { memberBalances, pairwiseDebts, type Debt, type MemberBalance } from './balance';
import { sharedEntryInputSchema, type SharedEntry } from './shared-entry';
import { canonicalMember, type SharedMember } from './shared-member';
import { seededRandom } from './test/random';
import { mergeMember, randomGroup } from './test/random-group';

const GROUPS = 500;

const members: SharedMember[] = [
    { id: 'ana', mergedInto: null },
    { id: 'bruno', mergedInto: null },
    { id: 'carla', mergedInto: null },
];

function expense(
    id: string,
    paidBy: string,
    shares: Record<string, number>,
    deletedAt: number | null = null
): SharedEntry {
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
        deletedAt,
    };
}

function settlement(id: string, from: string, to: string, cents: number): SharedEntry {
    return {
        id,
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: cents,
        currency: 'EUR',
        date: '2026-10-26',
        paidBy: from,
        split: 'exact',
        shares: [{ memberId: to, cents }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 2,
        updatedAt: 2,
        deletedAt: null,
    };
}

function balanceOf(balances: readonly MemberBalance[], memberId: string): number {
    return balances.find((balance) => balance.memberId === memberId)?.cents ?? 0;
}

function linesOf(debts: readonly Debt[], memberId: string): number {
    return debts.reduce(
        (sum, debt) => sum + (debt.to === memberId ? debt.cents : 0) - (debt.from === memberId ? debt.cents : 0),
        0
    );
}

describe('memberBalances', () => {
    it('credits the payer with the whole amount and debits each member their share', () => {
        const entries = [expense('dinner', 'ana', { ana: 1000, bruno: 1000, carla: 1000 })];

        expect(memberBalances(entries, members)).toEqual([
            { memberId: 'ana', cents: 2000 },
            { memberId: 'bruno', cents: -1000 },
            { memberId: 'carla', cents: -1000 },
        ]);
    });

    it('lists every member in the group order, with nothing for those who had no part', () => {
        const entries = [expense('taxi', 'carla', { bruno: 1200 })];

        expect(memberBalances(entries, members)).toEqual([
            { memberId: 'ana', cents: 0 },
            { memberId: 'bruno', cents: -1200 },
            { memberId: 'carla', cents: 1200 },
        ]);
    });

    it('credits a settlement to whoever paid it and debits whoever received it', () => {
        const entries = [
            expense('dinner', 'bruno', { ana: 3000, bruno: 3000 }),
            settlement('pay', 'ana', 'bruno', 3000),
        ];

        expect(memberBalances(entries, members).map((balance) => balance.cents)).toEqual([0, 0, 0]);
    });

    it('leaves out the entries that were deleted', () => {
        const entries = [
            expense('dinner', 'ana', { ana: 1000, bruno: 1000 }),
            expense('lunch', 'bruno', { ana: 5000 }, 1700000000000),
        ];

        expect(memberBalances(entries, members)).toEqual([
            { memberId: 'ana', cents: 1000 },
            { memberId: 'bruno', cents: -1000 },
            { memberId: 'carla', cents: 0 },
        ]);
    });

    it('still lists a member who left, with the balance a late entry left them', () => {
        const withLeft = [...members, { id: 'dani', mergedInto: null, leftAt: 1700000000000 }];
        const entries = [expense('late', 'ana', { ana: 500, dani: 500 })];

        expect(balanceOf(memberBalances(entries, withLeft), 'dani')).toBe(-500);
    });

    it('reads a merged placeholder as the member it was merged into, and lists it no more', () => {
        const withDummy = [...members, { id: 'dummy', mergedInto: 'bruno' }];
        const entries = [
            expense('dinner', 'ana', { ana: 1500, dummy: 1500 }),
            expense('taxi', 'carla', { bruno: 800 }),
        ];

        expect(memberBalances(entries, withDummy)).toEqual([
            { memberId: 'ana', cents: 1500 },
            { memberId: 'bruno', cents: -2300 },
            { memberId: 'carla', cents: 800 },
        ]);
    });

    it('lists an id the entries name and the members do not after the members', () => {
        const entries = [expense('dinner', 'ana', { ana: 1000, eve: 1000 })];

        expect(memberBalances(entries, members)).toEqual([
            { memberId: 'ana', cents: 1000 },
            { memberId: 'bruno', cents: 0 },
            { memberId: 'carla', cents: 0 },
            { memberId: 'eve', cents: -1000 },
        ]);
    });
});

describe('pairwiseDebts', () => {
    it('has each member with a share owe the payer that share', () => {
        const entries = [expense('dinner', 'ana', { ana: 1000, bruno: 1000, carla: 1000 })];

        expect(pairwiseDebts(entries, members)).toEqual([
            { from: 'bruno', to: 'ana', cents: 1000 },
            { from: 'carla', to: 'ana', cents: 1000 },
        ]);
    });

    it('nets what two members owe each other into one debt', () => {
        const entries = [
            expense('dinner', 'ana', { ana: 1500, bruno: 1500 }),
            expense('coffee', 'bruno', { ana: 500, bruno: 500 }),
        ];

        expect(pairwiseDebts(entries, members)).toEqual([{ from: 'bruno', to: 'ana', cents: 1000 }]);
    });

    it('lists no pair whose debts cancel out', () => {
        const entries = [expense('dinner', 'ana', { bruno: 700 }), expense('lunch', 'bruno', { ana: 700 })];

        expect(pairwiseDebts(entries, members)).toEqual([]);
    });

    describe('when Ana owes Bruno 30 €', () => {
        const owing = expense('dinner', 'bruno', { ana: 3000 });

        it('settles the pair with a settlement of exactly the debt', () => {
            const entries = [owing, settlement('pay', 'ana', 'bruno', 3000)];

            expect(pairwiseDebts(entries, members)).toEqual([]);
            expect(memberBalances(entries, members).every((balance) => balance.cents === 0)).toBe(true);
        });

        it('leaves the rest owed after a settlement of less', () => {
            const entries = [owing, settlement('pay', 'ana', 'bruno', 1000)];

            expect(pairwiseDebts(entries, members)).toEqual([{ from: 'ana', to: 'bruno', cents: 2000 }]);
        });

        it('turns the debt round after a settlement of 50 €: Bruno owes Ana 20 €', () => {
            const entries = [owing, settlement('pay', 'ana', 'bruno', 5000)];

            expect(pairwiseDebts(entries, members)).toEqual([{ from: 'bruno', to: 'ana', cents: 2000 }]);
            expect(balanceOf(memberBalances(entries, members), 'ana')).toBe(2000);
            expect(balanceOf(memberBalances(entries, members), 'bruno')).toBe(-2000);
        });
    });

    it('leaves out the entries that were deleted', () => {
        const entries = [expense('dinner', 'ana', { bruno: 1000 }, 1700000000000)];

        expect(pairwiseDebts(entries, members)).toEqual([]);
    });

    it('owes nothing for a share of the payer, also once a merge makes them one', () => {
        const withDummy = [...members, { id: 'dummy', mergedInto: 'bruno' }];
        const entries = [
            expense('dinner', 'dummy', { dummy: 1000, bruno: 1000 }),
            settlement('pay', 'dummy', 'bruno', 400),
            expense('taxi', 'ana', { dummy: 600 }),
        ];

        expect(pairwiseDebts(entries, withDummy)).toEqual([{ from: 'bruno', to: 'ana', cents: 600 }]);
        expect(memberBalances(entries, withDummy)).toEqual([
            { memberId: 'ana', cents: 600 },
            { memberId: 'bruno', cents: -600 },
            { memberId: 'carla', cents: 0 },
        ]);
    });
});

describe('on merges the server never makes', () => {
    it('reads a chain of merges as its end, listing only that member', () => {
        const chain = [...members, { id: 'first', mergedInto: 'second' }, { id: 'second', mergedInto: 'carla' }];
        const entries = [
            expense('dinner', 'ana', { ana: 1000, first: 1000 }),
            expense('taxi', 'second', { bruno: 500 }),
        ];

        expect(memberBalances(entries, chain)).toEqual([
            { memberId: 'ana', cents: 1000 },
            { memberId: 'bruno', cents: -500 },
            { memberId: 'carla', cents: -500 },
        ]);
        expect(pairwiseDebts(entries, chain)).toEqual([
            { from: 'carla', to: 'ana', cents: 1000 },
            { from: 'bruno', to: 'carla', cents: 500 },
        ]);
    });

    it('lists a member merged into itself in its place', () => {
        const selfMerged = [members[0]!, { id: 'self', mergedInto: 'self' }, members[1]!];
        const entries = [expense('dinner', 'self', { bruno: 700 })];

        expect(memberBalances(entries, selfMerged)).toEqual([
            { memberId: 'ana', cents: 0 },
            { memberId: 'self', cents: 700 },
            { memberId: 'bruno', cents: -700 },
        ]);
    });

    it('reads a loop of merges as one member, whose balances still add up to zero', () => {
        const loop = [...members, { id: 'x', mergedInto: 'y' }, { id: 'y', mergedInto: 'x' }];
        const entries = [expense('dinner', 'y', { x: 400, ana: 600 }), settlement('pay', 'ana', 'x', 600)];

        expect(memberBalances(entries, loop)).toEqual([
            { memberId: 'ana', cents: 0 },
            { memberId: 'bruno', cents: 0 },
            { memberId: 'carla', cents: 0 },
            { memberId: 'x', cents: 0 },
        ]);
        expect(pairwiseDebts(entries, loop)).toEqual([]);
    });

    it('lists only the members ids are read as, once each, adding up to zero, whatever the merges', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const group = randomGroup(random);
            const ids = group.members.map((member) => member.id);
            const people = group.members.map((member) => ({
                ...member,
                mergedInto: random.chance(0.4) ? random.pick(ids) : null,
            }));

            const balances = memberBalances(group.entries, people);
            const debts = pairwiseDebts(group.entries, people);

            const listed = balances.map((balance) => balance.memberId);
            expect(new Set(listed).size, `seed ${seed}`).toBe(listed.length);
            expect(
                listed.every((id) => canonicalMember(people, id) === id),
                `seed ${seed}`
            ).toBe(true);
            expect(
                balances.reduce((sum, balance) => sum + balance.cents, 0),
                `seed ${seed}`
            ).toBe(0);
            for (const { memberId, cents } of balances) expect(linesOf(debts, memberId), `seed ${seed}`).toBe(cents);
            expect(
                debts.every((debt) => listed.includes(debt.from) && listed.includes(debt.to)),
                `seed ${seed}`
            ).toBe(true);
        }
    });
});

describe('over many groups', () => {
    it('works on entries the schema accepts', () => {
        for (let seed = 1; seed <= 50; seed++) {
            const { entries } = randomGroup(seededRandom(seed));

            expect(
                entries.every((entry) => v.is(sharedEntryInputSchema, entry)),
                `seed ${seed}`
            ).toBe(true);
        }
    });

    it('has balances that add up to zero, each one what the lines of that member add up to', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const { members: people, entries } = randomGroup(seededRandom(seed));

            const balances = memberBalances(entries, people);
            const debts = pairwiseDebts(entries, people);

            expect(
                balances.reduce((sum, balance) => sum + balance.cents, 0),
                `seed ${seed}`
            ).toBe(0);
            for (const { memberId, cents } of balances) expect(linesOf(debts, memberId), `seed ${seed}`).toBe(cents);
        }
    });

    it('lists each pair once at most, never at zero and never a member owing themselves', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const { members: people, entries } = randomGroup(seededRandom(seed));

            const debts = pairwiseDebts(entries, people);
            const pairs = debts.map((debt) => [debt.from, debt.to].sort().join(' '));

            expect(new Set(pairs).size, `seed ${seed}`).toBe(debts.length);
            expect(
                debts.every((debt) => debt.cents > 0 && debt.from !== debt.to),
                `seed ${seed}`
            ).toBe(true);
        }
    });

    it('is the same without the entries that were deleted', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const { members: people, entries } = randomGroup(seededRandom(seed));
            const live = entries.filter((entry) => entry.deletedAt === null);

            expect(memberBalances(entries, people), `seed ${seed}`).toEqual(memberBalances(live, people));
            expect(pairwiseDebts(entries, people), `seed ${seed}`).toEqual(pairwiseDebts(live, people));
        }
    });

    it('moves the balance of a merged placeholder to its target, and nothing else', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const { members: people, entries } = randomGroup(random);
            const placeholder = random.pick(people).id;
            const target = random.pick(people).id;
            if (placeholder === target) continue;

            const before = memberBalances(entries, people);
            const merged = mergeMember(people, placeholder, target);
            const after = memberBalances(entries, merged);

            expect(after, `seed ${seed}`).toEqual(
                before
                    .filter((balance) => balance.memberId !== placeholder)
                    .map((balance) =>
                        balance.memberId === target
                            ? { memberId: target, cents: balance.cents + balanceOf(before, placeholder) }
                            : balance
                    )
            );
            const debts = pairwiseDebts(entries, merged);
            for (const { memberId, cents } of after) expect(linesOf(debts, memberId), `seed ${seed}`).toBe(cents);
        }
    });

    it('settles a pair with a settlement of exactly its debt and leaves the other pairs as they were', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const { members: people, entries } = randomGroup(random);
            const debts = pairwiseDebts(entries, people);
            if (debts.length === 0) continue;
            const debt = random.pick(debts);

            const settled = pairwiseDebts([...entries, settlement('pay', debt.from, debt.to, debt.cents)], people);

            expect(settled, `seed ${seed}`).toEqual(debts.filter((other) => other !== debt));
        }
    });

    it('turns a debt round by what a settlement pays over it', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const { members: people, entries } = randomGroup(random);
            const debts = pairwiseDebts(entries, people);
            if (debts.length === 0) continue;
            const debt = random.pick(debts);
            const over = random.int(1, 10_000);

            const settled = pairwiseDebts(
                [...entries, settlement('pay', debt.from, debt.to, debt.cents + over)],
                people
            );

            expect(settled, `seed ${seed}`).toEqual(
                debts.map((other) => (other === debt ? { from: debt.to, to: debt.from, cents: over } : other))
            );
        }
    });
});
