import { describe, expect, it } from 'vitest';

import { countedCents, countedOn, paidBackCents, voucherIncomeOn } from './counting';
import { NO_FILTERS, buildList, type ListContext } from './expense-list';
import { sharedExpenseRows, yourPart, type SharedLedger } from './shared-expense';
import { summarizeMonth } from './summary';
import { seededRandom } from './test/random';
import { mergeMember, randomGroup } from './test/random-group';

import type { Expense, Payment } from './expense';
import type { SharedEntry } from './shared-entry';

const GROUPS = 500;

const members = [
    { id: 'ana', mergedInto: null },
    { id: 'bruno', mergedInto: null },
    { id: 'carla', mergedInto: null },
];

function dinner(paidBy: string, shares: Record<string, number>, payment: Payment = 'direct'): SharedEntry {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        id: 'dinner',
        kind: 'expense',
        text: 'Dinner in Lisbon',
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-10-12',
        paidBy,
        split: 'equal',
        shares: list,
        payment,
        chargeDate: payment === 'direct' ? null : '2026-11-12',
        createdAt: 5,
        updatedAt: 6,
        deletedAt: null,
    };
}

function settlement(from: string, to: string): SharedEntry {
    return {
        id: 'settle',
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 2000,
        currency: 'EUR',
        date: '2026-10-20',
        paidBy: from,
        split: 'exact',
        shares: [{ memberId: to, cents: 2000 }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 7,
        updatedAt: 7,
        deletedAt: null,
    };
}

function ledger(entries: SharedEntry[], overrides: Partial<SharedLedger> = {}): SharedLedger {
    return { groupId: 'lisbon', me: 'ana', showInExpenses: true, members, entries, ...overrides };
}

function personal(overrides: Partial<Expense>): Expense {
    return {
        id: 'personal',
        categoryId: 'food',
        text: 'Dinner in Lisbon',
        amountCents: 0,
        currency: 'EUR',
        date: '2026-10-12',
        createdAt: 5,
        updatedAt: 6,
        deletedAt: null,
        ...overrides,
    };
}

const thirds = { ana: 3000, bruno: 3000, carla: 3000 };

describe('sharedExpenseRows', () => {
    it('gives you your part as an expense paid now when somebody else paid', () => {
        expect(sharedExpenseRows([ledger([dinner('bruno', thirds)])])).toEqual([
            {
                id: 'dinner',
                categoryId: 'food',
                text: 'Dinner in Lisbon',
                amountCents: 3000,
                currency: 'EUR',
                date: '2026-10-12',
                payment: 'direct',
                chargeDate: null,
                createdAt: 5,
                updatedAt: 6,
                deletedAt: null,
                shared: { groupId: 'lisbon', paidBy: 'bruno', totalCents: 9000 },
            },
        ]);
    });

    it.each(['credit', 'voucher'] as const)(
        'counts your part as paid now on the day it was made when somebody else paid by %s card',
        (card) => {
            const [row] = sharedExpenseRows([ledger([dinner('bruno', thirds, card)])]);

            expect(row).toMatchObject({ amountCents: 3000, payment: 'direct', chargeDate: null });
            expect(countedOn(row!)).toBe('2026-10-12');
            expect(countedCents(row!)).toBe(3000);
            expect(voucherIncomeOn(row!)).toBeNull();
        }
    );

    it('gives the payer who paid at once their part, paid now', () => {
        const [row] = sharedExpenseRows([ledger([dinner('ana', thirds)])]);

        expect(row).toMatchObject({ amountCents: 3000, payment: 'direct', chargeDate: null });
        expect(row?.shared).toEqual({ groupId: 'lisbon', paidBy: 'ana', totalCents: 9000 });
    });

    it('gives the payer by credit card their part, counted on the day it is charged', () => {
        const [row] = sharedExpenseRows([ledger([dinner('ana', thirds, 'credit')])]);

        expect(row).toMatchObject({ amountCents: 3000, payment: 'credit', chargeDate: '2026-11-12' });
        expect(countedOn(row!)).toBe('2026-11-12');
    });

    it('gives the payer by restaurant card the total, with their part as theirs', () => {
        const [row] = sharedExpenseRows([ledger([dinner('ana', thirds, 'voucher')])]);

        expect(row).toMatchObject({
            amountCents: 9000,
            personalCents: 3000,
            payment: 'voucher',
            chargeDate: '2026-11-12',
        });
    });

    it.each([
        ['an expense that was deleted', { ...dinner('bruno', thirds), deletedAt: 7 }],
        ['an expense you are out of', dinner('bruno', { bruno: 4500, carla: 4500 })],
        ['a settlement you paid', settlement('ana', 'bruno')],
        ['a settlement you received', settlement('bruno', 'ana')],
    ])('gives nothing for %s', (_name, entry) => {
        expect(sharedExpenseRows([ledger([entry])])).toEqual([]);
    });

    it('gives nothing from a group whose switch Show in my expenses is off, and goes on with the others', () => {
        const rows = sharedExpenseRows([
            ledger([dinner('bruno', thirds)], { showInExpenses: false }),
            ledger([{ ...dinner('bruno', thirds), id: 'taxi' }], { groupId: 'bruno' }),
        ]);

        expect(rows.map((row) => [row.id, row.shared.groupId])).toEqual([['taxi', 'bruno']]);
    });

    it('counts the shares of a placeholder merged into you as yours', () => {
        const merged = ledger([dinner('bruno', { ana: 3000, dummy: 2000, bruno: 3000 })], {
            members: [...members, { id: 'dummy', mergedInto: 'ana' }],
        });

        expect(sharedExpenseRows([merged])).toMatchObject([{ amountCents: 5000, payment: 'direct' }]);
    });

    it('makes you the payer of what a placeholder merged into you paid, by the card it paid with', () => {
        const merged = ledger([dinner('dummy', { dummy: 3000, bruno: 3000 }, 'voucher')], {
            members: [...members, { id: 'dummy', mergedInto: 'ana' }],
        });

        expect(sharedExpenseRows([merged])).toMatchObject([
            {
                amountCents: 6000,
                personalCents: 3000,
                payment: 'voucher',
                shared: { groupId: 'lisbon', paidBy: 'ana', totalCents: 6000 },
            },
        ]);
    });

    it('says who paid through a merge', () => {
        const merged = ledger([dinner('dummy', thirds)], {
            members: [...members, { id: 'dummy', mergedInto: 'bruno' }],
        });

        expect(sharedExpenseRows([merged])[0]?.shared.paidBy).toBe('bruno');
    });

    describe('a dinner of 40 € on 12 October that you paid with the restaurant card, 20 € of it yours', () => {
        const [row] = sharedExpenseRows([ledger([dinner('ana', { ana: 2000, bruno: 2000 }, 'voucher')])]);
        const alone = personal({
            amountCents: 4000,
            personalCents: 2000,
            payment: 'voucher',
            chargeDate: '2026-11-12',
        });

        it('counts as the same expense of yours alone, Bruno paying you back his half', () => {
            expect(countedOn(row!)).toBe(countedOn(alone));
            expect(countedCents(row!)).toBe(countedCents(alone));
            expect(paidBackCents(row!)).toBe(paidBackCents(alone));
            expect(voucherIncomeOn(row!)).toEqual(voucherIncomeOn(alone));
        });

        it.each(['2026-10', '2026-11'])('sums up %s as that expense alone would', (month) => {
            expect(summarizeMonth(month, [row!], 150_000)).toEqual(summarizeMonth(month, [alone], 150_000));
        });

        it('is 20 spent and 20 paid back in October, and 20 of restaurant card income in November', () => {
            expect(summarizeMonth('2026-10', [row!], null)).toMatchObject({ spentCents: 2000, paidBackCents: 2000 });
            expect(summarizeMonth('2026-11', [row!], null)).toMatchObject({ spentCents: 0, voucherCents: 2000 });
        });
    });

    it('counts your credit card dinner as a credit card expense of your part alone', () => {
        const [row] = sharedExpenseRows([ledger([dinner('ana', thirds, 'credit')])]);
        const alone = personal({ amountCents: 3000, payment: 'credit', chargeDate: '2026-11-12' });

        for (const month of ['2026-10', '2026-11']) {
            expect(summarizeMonth(month, [row!], null)).toEqual(summarizeMonth(month, [alone], null));
        }
    });

    it('goes through the expense list as it is, adding your part to the subtotal', () => {
        const rows = sharedExpenseRows([
            ledger([dinner('ana', { ana: 2000, bruno: 2000 }, 'voucher')]),
            ledger([{ ...dinner('carla', { ana: 1500, carla: 1500 }), id: 'taxi' }], { groupId: 'carla' }),
        ]);
        const ctx: ListContext = { categoryOf: (id) => id, labelOf: (id) => id };

        const [day] = buildList(rows, NO_FILTERS, 'day', ctx);

        expect(day?.key).toBe('2026-10-12');
        expect(day?.totalCents).toBe(3500);
    });

    it('gives everybody rows whose counted parts add up to the expenses, and none for a settlement', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const group = randomGroup(random);
            const people = random.chance(0.3)
                ? mergeMember(group.members, random.pick(group.members.slice(1)).id, group.members[0]!.id)
                : group.members;
            const live = group.entries.filter((entry) => entry.kind === 'expense' && entry.deletedAt === null);

            const rows = people.flatMap((member) =>
                sharedExpenseRows([
                    { groupId: 'g', me: member.id, showInExpenses: true, members: people, entries: group.entries },
                ])
            );

            const counted = rows.map(countedCents);
            expect(
                counted.reduce((sum, cents) => sum + cents, 0),
                `seed ${seed}`
            ).toBe(live.reduce((sum, entry) => sum + entry.amountCents, 0));
            expect(
                counted.every((cents) => cents > 0),
                `seed ${seed}`
            ).toBe(true);
            expect(
                rows.every((row) => live.some((entry) => entry.id === row.id)),
                `seed ${seed}`
            ).toBe(true);
        }
    });
});

describe('yourPart', () => {
    it('is your share of an expense, and nothing when you are out of it', () => {
        expect(yourPart(dinner('bruno', thirds), 'ana', members)).toBe(3000);
        expect(yourPart(dinner('bruno', { bruno: 9000 }), 'ana', members)).toBe(0);
    });

    it('adds the shares of the placeholders merged into you', () => {
        const withDummy = [...members, { id: 'dummy', mergedInto: 'ana' }];

        expect(yourPart(dinner('bruno', { ana: 1000, dummy: 2500 }), 'ana', withDummy)).toBe(3500);
    });
});
