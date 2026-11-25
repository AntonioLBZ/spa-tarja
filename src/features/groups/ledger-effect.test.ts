import { describe, expect, it } from 'vitest';

import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/testing/groups';

import { ledgerEffect } from './ledger-effect';

const ana = person('Ana');
const bea = person('Bea');
const cris = person('Cris');
const group = sampleGroup({ members: [ana, bea, cris], me: ana.id });
const shares = (cents: number, ...members: (typeof ana)[]) => members.map((member) => ({ memberId: member.id, cents }));

describe('ledgerEffect', () => {
    it('raises your balance by what the others owe of what you paid', () => {
        const entry = sampleEntry(group, { paidBy: ana.id, amountCents: 3000, shares: shares(1000, ana, bea, cris) });

        expect(ledgerEffect(entry, group)).toMatchObject({ cents: 2000, touch: 'moves', paidByMe: true });
    });

    it('lowers it by your share of what someone else paid', () => {
        const entry = sampleEntry(group, { paidBy: bea.id, amountCents: 3000, shares: shares(1000, ana, bea, cris) });

        expect(ledgerEffect(entry, group)).toMatchObject({ cents: -1000, touch: 'moves', part: 1000 });
    });

    it('is just yours when you paid it all for yourself, and not yours when you are not in it', () => {
        const mine = sampleEntry(group, { paidBy: ana.id, amountCents: 1500, shares: shares(1500, ana) });
        const theirs = sampleEntry(group, { paidBy: bea.id, amountCents: 2000, shares: shares(1000, bea, cris) });

        expect(ledgerEffect(mine, group)).toMatchObject({ cents: 0, touch: 'justYou' });
        expect(ledgerEffect(theirs, group)).toMatchObject({ cents: 0, touch: 'notIn' });
    });

    it('raises it for a settlement you paid and lowers it for one you were paid', () => {
        expect(ledgerEffect(sampleSettlement(group, ana.id, bea.id, 1100), group).cents).toBe(1100);
        expect(ledgerEffect(sampleSettlement(group, bea.id, ana.id, 800), group).cents).toBe(-800);
        expect(ledgerEffect(sampleSettlement(group, bea.id, cris.id, 400), group).touch).toBe('notIn');
    });
});
