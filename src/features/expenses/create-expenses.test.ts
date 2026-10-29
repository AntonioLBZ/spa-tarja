import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { addMonths } from '@core/date';
import { expenseInputSchema, type Expense } from '@core/expense';

import { canEdit, createExpenses, draftOf, restoreExpenses, reviseExpenses, type Draft } from './create-expenses';

const NOW = 1_800_000_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-24',
        payment: 'direct',
        chargeDate: null,
        personalCents: null,
        plan: null,
        createdAt: 1_000,
        updatedAt: 2_000,
        deletedAt: null,
        ...overrides,
    };
}

function plan(amounts: readonly number[], overrides: Partial<Expense> = {}): Expense[] {
    const id = crypto.randomUUID();
    return amounts.map((amountCents, index) =>
        expense({
            text: 'Sofa',
            categoryId: 'housing',
            amountCents,
            chargeDate: addMonths('2026-10-24', index),
            plan: { id, part: index + 1, parts: amounts.length },
            ...overrides,
        })
    );
}

function draft(overrides: Partial<Draft> = {}): Draft {
    return {
        categoryId: 'food',
        text: 'Lunch',
        date: '2026-10-24',
        payment: 'direct',
        chargeDate: null,
        personalCents: null,
        amounts: [1250],
        ...overrides,
    };
}

function expectAccepted(writes: readonly Expense[]) {
    for (const write of writes) expect(v.safeParse(expenseInputSchema, write).issues).toBeUndefined();
}

describe('draftOf', () => {
    it('fills the form with what an expense says', () => {
        const lunch = expense({ categoryId: 'leisure', text: 'Cinema', amountCents: 900, date: '2026-10-20' });

        expect(draftOf([lunch])).toEqual({
            categoryId: 'leisure',
            text: 'Cinema',
            date: '2026-10-20',
            payment: 'direct',
            chargeDate: null,
            personalCents: null,
            amounts: [900],
        });
    });

    it('keeps how a card payment was paid and the day it is charged', () => {
        const shoes = expense({ payment: 'credit', chargeDate: '2026-11-30' });

        expect(draftOf([shoes])).toMatchObject({ payment: 'credit', chargeDate: '2026-11-30', personalCents: null });
    });

    it('keeps your part of a restaurant card expense', () => {
        const dinner = expense({
            payment: 'voucher',
            chargeDate: '2026-11-12',
            amountCents: 4000,
            personalCents: 2000,
        });

        expect(draftOf([dinner])).toMatchObject({
            payment: 'voucher',
            chargeDate: '2026-11-12',
            personalCents: 2000,
            amounts: [4000],
        });
    });

    it('reads an expense that never said how it was paid as paid at once, with nothing else to it', () => {
        const old: Expense = {
            id: crypto.randomUUID(),
            categoryId: 'food',
            text: 'Lunch',
            amountCents: 1250,
            currency: 'EUR',
            date: '2026-10-24',
            createdAt: 1_000,
            updatedAt: 2_000,
            deletedAt: null,
        };

        expect(draftOf([old])).toMatchObject({ payment: 'direct', chargeDate: null, personalCents: null });
    });

    it('fills the form with every payment of a plan, in the order of the plan, and no charge date of its own', () => {
        const sofa = plan([501, 500, 499]);

        expect(draftOf(sofa.toReversed())).toEqual({
            categoryId: 'housing',
            text: 'Sofa',
            date: '2026-10-24',
            payment: 'direct',
            chargeDate: null,
            personalCents: null,
            amounts: [501, 500, 499],
        });
    });
});

describe('canEdit', () => {
    it('allows an expense', () => {
        expect(canEdit([expense()])).toBe(true);
    });

    it('allows a plan with every one of its parts', () => {
        expect(canEdit(plan([500, 500, 500]).toReversed())).toBe(true);
    });

    it('refuses a plan with a part that is not on this device', () => {
        const sofa = plan([500, 500, 500]);

        expect(canEdit([sofa[0]!, sofa[2]!])).toBe(false);
        expect(canEdit([sofa[0]!])).toBe(false);
    });

    it('refuses a plan whose parts do not agree on how many there are', () => {
        const sofa = plan([500, 500]);
        const odd = { ...sofa[1]!, plan: { ...sofa[1]!.plan!, parts: 3 } };

        expect(canEdit([sofa[0]!, odd])).toBe(false);
    });
});

describe('createExpenses', () => {
    it('sends no part of your own for anything but a restaurant card', () => {
        const [write] = createExpenses(draft({ payment: 'credit', chargeDate: '2026-11-24', personalCents: 500 }));

        expect(write!.personalCents).toBeNull();
    });
});

describe('reviseExpenses', () => {
    it('keeps the id and the creation time, and writes what the form holds', () => {
        const lunch = expense({ createdAt: 1_000, updatedAt: 2_000 });

        const writes = reviseExpenses(
            [lunch],
            draft({ categoryId: 'leisure', text: 'Cinema', amounts: [900], date: '2026-10-20' }),
            NOW
        );

        expect(writes).toEqual([
            {
                ...lunch,
                categoryId: 'leisure',
                text: 'Cinema',
                amountCents: 900,
                date: '2026-10-20',
                updatedAt: NOW,
            },
        ]);
        expectAccepted(writes);
    });

    it('keeps the currency of the expense it edits', () => {
        const trip = expense({ currency: 'USD' });

        const writes = reviseExpenses([trip], draft({ text: 'Taxi' }), NOW);

        expect(writes[0]).toMatchObject({ id: trip.id, currency: 'USD', text: 'Taxi' });
        expectAccepted(writes);
    });

    it('gives the payments a plan gains the currency of the plan', () => {
        const sofa = plan([750, 750], { currency: 'USD' });

        const writes = reviseExpenses(sofa, draft({ amounts: [500, 500, 500] }), NOW);

        expect(writes.map((write) => write.currency)).toEqual(['USD', 'USD', 'USD']);
        expectAccepted(writes);
    });

    it('is newer than what it replaces even when the clock of the device is behind', () => {
        const lunch = expense({ updatedAt: NOW + 5_000 });

        const [write] = reviseExpenses([lunch], draft(), NOW);

        expect(write!.updatedAt).toBe(NOW + 5_001);
    });

    it('is newer than the newest part of a plan', () => {
        const sofa = plan([500, 500]).map((part, index) => ({ ...part, updatedAt: NOW + index * 10 }));

        const writes = reviseExpenses(sofa, draft({ amounts: [500, 500] }), NOW);

        expect(writes.map((write) => write.updatedAt)).toEqual([NOW + 11, NOW + 11]);
    });

    it('keeps the charge date of a card payment', () => {
        const shoes = expense({ payment: 'credit', chargeDate: '2026-11-30' });

        const [write] = reviseExpenses(
            [shoes],
            draft({ payment: 'credit', chargeDate: '2026-11-30', text: 'Boots' }),
            NOW
        );

        expect(write).toMatchObject({ id: shoes.id, payment: 'credit', chargeDate: '2026-11-30', text: 'Boots' });
    });

    it('keeps the ids of a plan by part number, its plan and the day of each payment', () => {
        const sofa = plan([500, 500, 500]);

        const writes = reviseExpenses(sofa.toReversed(), draft({ text: 'Couch', amounts: [600, 500, 400] }), NOW);

        expect(writes.map((write) => [write.id, write.plan, write.amountCents, write.chargeDate])).toEqual([
            [sofa[0]!.id, sofa[0]!.plan, 600, '2026-10-24'],
            [sofa[1]!.id, sofa[1]!.plan, 500, '2026-11-24'],
            [sofa[2]!.id, sofa[2]!.plan, 400, '2026-12-24'],
        ]);
        expect(writes.every((write) => write.text === 'Couch' && write.deletedAt === null)).toBe(true);
        expectAccepted(writes);
    });

    it('adds the new payments of a plan under the same plan, with ids of their own', () => {
        const sofa = plan([750, 750], { createdAt: 1_500 });
        const planId = sofa[0]!.plan!.id;

        const writes = reviseExpenses(sofa, draft({ amounts: [500, 500, 500] }), NOW);

        expect(writes).toHaveLength(3);
        expect(writes.map((write) => write.plan)).toEqual([
            { id: planId, part: 1, parts: 3 },
            { id: planId, part: 2, parts: 3 },
            { id: planId, part: 3, parts: 3 },
        ]);
        expect(writes.slice(0, 2).map((write) => write.id)).toEqual(sofa.map((part) => part.id));
        expect(writes[2]!.id).toMatch(UUID);
        expect(sofa.map((part) => part.id)).not.toContain(writes[2]!.id);
        expect(writes[2]).toMatchObject({ chargeDate: '2026-12-24', createdAt: 1_500, updatedAt: NOW });
        expectAccepted(writes);
    });

    it('saves the payments a plan no longer has as deleted', () => {
        const sofa = plan([500, 500, 500]);
        const planId = sofa[0]!.plan!.id;

        const writes = reviseExpenses(sofa, draft({ amounts: [750, 750] }), NOW);

        expect(writes.map((write) => [write.id, write.plan, write.amountCents, write.deletedAt])).toEqual([
            [sofa[0]!.id, { id: planId, part: 1, parts: 2 }, 750, null],
            [sofa[1]!.id, { id: planId, part: 2, parts: 2 }, 750, null],
            [sofa[2]!.id, sofa[2]!.plan, 500, NOW],
        ]);
        expect(writes[2]!.updatedAt).toBe(NOW);
        expectAccepted(writes);
    });

    it('turns a plan into one payment that keeps the id of its first part, deleting the others', () => {
        const sofa = plan([500, 500, 500]);

        const writes = reviseExpenses(sofa, draft({ amounts: [1500] }), NOW);

        expect(writes[0]).toMatchObject({ id: sofa[0]!.id, plan: null, chargeDate: null, amountCents: 1500 });
        expect(writes.slice(1).map((write) => [write.id, write.deletedAt])).toEqual([
            [sofa[1]!.id, NOW],
            [sofa[2]!.id, NOW],
        ]);
        expectAccepted(writes);
    });

    it('turns a plan into a credit card payment charged on the day the person picked', () => {
        const sofa = plan([500, 500, 500]);

        const writes = reviseExpenses(
            sofa,
            draft({ payment: 'credit', chargeDate: '2026-11-24', amounts: [1500] }),
            NOW
        );

        expect(writes[0]).toMatchObject({
            id: sofa[0]!.id,
            payment: 'credit',
            chargeDate: '2026-11-24',
            plan: null,
            amountCents: 1500,
            deletedAt: null,
        });
        expect(writes.slice(1).every((write) => write.deletedAt === NOW)).toBe(true);
        expectAccepted(writes);
    });

    it('turns an expense into the first payment of a new plan', () => {
        const lunch = expense({ createdAt: 1_500 });

        const writes = reviseExpenses([lunch], draft({ amounts: [700, 700] }), NOW);

        const planId = writes[0]!.plan!.id;
        expect(planId).toMatch(UUID);
        expect(planId).not.toBe(lunch.id);
        expect(writes.map((write) => [write.plan, write.chargeDate, write.createdAt])).toEqual([
            [{ id: planId, part: 1, parts: 2 }, '2026-10-24', 1_500],
            [{ id: planId, part: 2, parts: 2 }, '2026-11-24', 1_500],
        ]);
        expect(writes[0]!.id).toBe(lunch.id);
        expect(writes[1]!.id).toMatch(UUID);
        expect(writes[1]!.id).not.toBe(lunch.id);
        expectAccepted(writes);
    });

    it('sends no part of your own once a restaurant card expense is paid another way', () => {
        const dinner = expense({
            payment: 'voucher',
            chargeDate: '2026-11-12',
            amountCents: 4000,
            personalCents: 2000,
        });

        const writes = reviseExpenses(
            [dinner],
            draft({ payment: 'credit', chargeDate: '2026-11-12', personalCents: 2000, amounts: [4000] }),
            NOW
        );

        expect(writes[0]).toMatchObject({ payment: 'credit', personalCents: null });
        expectAccepted(writes);
    });

    it('keeps your part of a restaurant card expense', () => {
        const dinner = expense({
            payment: 'voucher',
            chargeDate: '2026-11-12',
            amountCents: 4000,
            personalCents: 2000,
        });

        const writes = reviseExpenses([dinner], { ...draftOf([dinner]), text: 'Dinner for two' }, NOW);

        expect(writes[0]).toMatchObject({
            id: dinner.id,
            payment: 'voucher',
            chargeDate: '2026-11-12',
            personalCents: 2000,
            amountCents: 4000,
            text: 'Dinner for two',
        });
        expectAccepted(writes);
    });
});

describe('restoreExpenses', () => {
    it('writes the expense again, not deleted and newer than the delete, with everything else as it was', () => {
        const lunch = expense({
            updatedAt: NOW - 5_000,
            deletedAt: NOW - 5_000,
            personalCents: 600,
            payment: 'voucher',
            chargeDate: '2026-11-24',
        });

        const [restored] = restoreExpenses([lunch], NOW);

        expect(restored).toEqual({ ...lunch, updatedAt: NOW, deletedAt: null });
        expectAccepted([restored!]);
    });

    it('is newer than the delete even when the clock of the device is behind', () => {
        const lunch = expense({ updatedAt: NOW + 600_000, deletedAt: NOW + 600_000 });

        const [restored] = restoreExpenses([lunch], NOW);

        expect(restored).toMatchObject({ updatedAt: NOW + 600_001, deletedAt: null });
    });

    it('brings every part of a plan back, each newer than its own delete', () => {
        const sofa = plan([500, 500, 500]).map((part, index) => ({
            ...part,
            updatedAt: NOW - 1_000 * (index + 1),
            deletedAt: NOW - 1_000 * (index + 1),
        }));

        const restored = restoreExpenses(sofa, NOW);

        expect(restored.map((part) => [part.id, part.plan, part.deletedAt, part.updatedAt])).toEqual(
            sofa.map((part) => [part.id, part.plan, null, NOW])
        );
        expectAccepted(restored);
    });

    it('takes the time of the device when no moment is given', () => {
        const before = Date.now();

        const [restored] = restoreExpenses([expense({ updatedAt: 1_000, deletedAt: 1_000 })]);

        expect(restored!.updatedAt).toBeGreaterThanOrEqual(before);
        expect(restored!.deletedAt).toBeNull();
    });
});
