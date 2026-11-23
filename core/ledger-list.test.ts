import { describe, expect, it } from 'vitest';

import { NO_LEDGER_FILTERS, filterLedger, ledgerFilterCount, type LedgerContext } from './ledger-list';
import { normalizeText } from './text';

import type { SharedEntry } from './shared-entry';
import type { SharedExpenseEntry } from './shared-expense';

const members = [
    { id: 'ana', mergedInto: null },
    { id: 'bea', mergedInto: null },
    { id: 'carlos', mergedInto: null },
    { id: 'dummy', mergedInto: 'bea' },
];

const expense = (
    id: string,
    fields: Partial<SharedExpenseEntry> & { shares: SharedEntry['shares'] }
): SharedExpenseEntry => ({
    id,
    kind: 'expense',
    text: '',
    categoryId: 'food',
    amountCents: fields.shares.reduce((sum, share) => sum + share.cents, 0),
    currency: 'EUR',
    date: '2026-10-12',
    paidBy: 'ana',
    split: 'exact',
    payment: 'direct',
    chargeDate: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...fields,
});

const settlement = (id: string, from: string, to: string, cents: number): SharedEntry => ({
    id,
    kind: 'settlement',
    text: '',
    categoryId: null,
    amountCents: cents,
    currency: 'EUR',
    date: '2026-10-20',
    paidBy: from,
    split: 'exact',
    shares: [{ memberId: to, cents }],
    payment: 'direct',
    chargeDate: null,
    createdAt: 2,
    updatedAt: 2,
    deletedAt: null,
});

const dinner = expense('dinner', {
    text: 'Dinner in Lisbon',
    date: '2026-10-12',
    shares: [
        { memberId: 'ana', cents: 1000 },
        { memberId: 'bea', cents: 1000 },
        { memberId: 'carlos', cents: 1000 },
    ],
});
const taxi = expense('taxi', {
    text: 'Taxi',
    categoryId: 'transport',
    date: '2026-11-02',
    paidBy: 'dummy',
    shares: [
        { memberId: 'ana', cents: 450 },
        { memberId: 'dummy', cents: 450 },
    ],
});
const tickets = expense('tickets', {
    text: 'Museum',
    categoryId: 'leisure',
    date: '2026-11-05',
    paidBy: 'bea',
    shares: [{ memberId: 'carlos', cents: 2500 }],
});
const payBack = settlement('pay-back', 'carlos', 'ana', 2000);

const entries = [dinner, taxi, tickets, payBack];

const words: Record<string, string> = { ana: 'Ana', bea: 'Bea', carlos: 'Carlos' };

const ctx: LedgerContext = {
    members,
    me: 'ana',
    textOf: (entry) => normalizeText(`${entry.text} ${entry.categoryId ?? ''} ${words[entry.paidBy] ?? 'Bea'}`),
};

const ids = (filters: Partial<typeof NO_LEDGER_FILTERS>) =>
    filterLedger(entries, { ...NO_LEDGER_FILTERS, ...filters }, ctx).map((entry) => entry.id);

describe('filterLedger', () => {
    it('keeps every entry in its order when nothing is chosen', () => {
        expect(ids({})).toEqual(['dinner', 'taxi', 'tickets', 'pay-back']);
    });

    it('keeps the expenses or the settlements alone', () => {
        expect(ids({ kind: 'expense' })).toEqual(['dinner', 'taxi', 'tickets']);
        expect(ids({ kind: 'settlement' })).toEqual(['pay-back']);
    });

    it('leaves out the settlements once a category is chosen, since they have none', () => {
        expect(ids({ categoryId: 'transport' })).toEqual(['taxi']);
    });

    it('keeps the days between both ends, either one open', () => {
        expect(ids({ from: '2026-11-02', to: '2026-11-05' })).toEqual(['taxi', 'tickets']);
        expect(ids({ from: '2026-10-20' })).toEqual(['taxi', 'tickets', 'pay-back']);
        expect(ids({ to: '2026-10-12' })).toEqual(['dinner']);
    });

    it('reads a merged placeholder as the member it became for who paid', () => {
        expect(ids({ paidBy: 'bea' })).toEqual(['taxi', 'tickets']);
        expect(ids({ paidBy: 'dummy' })).toEqual([]);
    });

    it('keeps the entries a member paid or has a share of, a settlement to them too', () => {
        expect(ids({ with: 'carlos' })).toEqual(['dinner', 'tickets', 'pay-back']);
        expect(ids({ with: 'ana' })).toEqual(['dinner', 'taxi', 'pay-back']);
        expect(ids({ with: 'bea' })).toEqual(['dinner', 'taxi', 'tickets']);
    });

    it('finds the words of what the row shows, ignoring case and accents', () => {
        expect(ids({ query: 'LISBÓN' })).toEqual(['dinner']);
        expect(ids({ query: 'bea' })).toEqual(['taxi', 'tickets']);
    });

    it('finds what the entry does to the person as well as the whole that was paid', () => {
        expect(ids({ query: '20' })).toEqual(['dinner', 'pay-back']);
        expect(ids({ query: '4,5' })).toEqual(['taxi']);
        expect(ids({ query: '30' })).toEqual(['dinner']);
        expect(ids({ query: '>24 <26' })).toEqual(['tickets']);
    });

    it('needs every filter at once', () => {
        expect(ids({ kind: 'expense', with: 'carlos', query: 'museum' })).toEqual(['tickets']);
    });
});

describe('ledgerFilterCount', () => {
    it('counts the search and each filter once, the two dates together', () => {
        expect(ledgerFilterCount(NO_LEDGER_FILTERS)).toBe(0);
        expect(ledgerFilterCount({ ...NO_LEDGER_FILTERS, query: '  ' })).toBe(0);
        expect(
            ledgerFilterCount({
                query: 'taxi',
                categoryId: 'food',
                from: '2026-10-01',
                to: '2026-10-31',
                paidBy: 'ana',
                with: 'bea',
                kind: 'expense',
            })
        ).toBe(6);
    });
});
