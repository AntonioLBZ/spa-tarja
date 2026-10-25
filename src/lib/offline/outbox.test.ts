import { describe, expect, it, vi } from 'vitest';

import { createMemoryStorage } from '@/lib/test/memory-storage';

import { createOutbox } from './outbox';

import type { Expense } from '@core/expense';

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
    return {
        id,
        categoryId: 'food',
        text: id,
        amountCents: 100,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
}

async function openOutbox(storage = createMemoryStorage()) {
    const outbox = createOutbox(storage);
    await outbox.ready;
    return { outbox, storage };
}

describe('outbox', () => {
    it('starts empty', async () => {
        const { outbox } = await openOutbox();

        expect(outbox.getState()).toEqual({ pending: [], rejected: 0 });
    });

    it('holds a saved expense as pending and tells its subscribers', async () => {
        const { outbox } = await openOutbox();
        const listener = vi.fn();
        outbox.subscribe(listener);

        await outbox.put(expense('a'));

        expect(outbox.getState().pending).toEqual([expense('a')]);
        expect(listener).toHaveBeenCalled();
    });

    it('keeps the same state object until something changes', async () => {
        const { outbox } = await openOutbox();
        await outbox.put(expense('a'));

        expect(outbox.getState()).toBe(outbox.getState());
    });

    it('stops notifying a listener once it unsubscribes', async () => {
        const { outbox } = await openOutbox();
        const listener = vi.fn();
        const unsubscribe = outbox.subscribe(listener);
        unsubscribe();

        await outbox.put(expense('a'));

        expect(listener).not.toHaveBeenCalled();
    });

    it('replaces the entry of an expense edited again, keeping its place', async () => {
        const { outbox } = await openOutbox();
        await outbox.put(expense('a'));
        await outbox.put(expense('b'));

        await outbox.put(expense('a', { text: 'edited', updatedAt: 2 }));

        expect(outbox.getState().pending.map((item) => [item.id, item.text])).toEqual([
            ['a', 'edited'],
            ['b', 'b'],
        ]);
    });

    it('is on disk by the time put resolves, and survives a reload', async () => {
        const { outbox, storage } = await openOutbox();
        await outbox.put(expense('a'));

        const reloaded = createOutbox(storage);
        await reloaded.ready;

        expect(reloaded.getState().pending).toEqual([expense('a')]);
    });

    it('drops a settled expense', async () => {
        const { outbox, storage } = await openOutbox();
        const sent = expense('a');
        await outbox.put(sent);

        await outbox.settle(sent);

        expect(outbox.getState().pending).toEqual([]);
        const reloaded = createOutbox(storage);
        await reloaded.ready;
        expect(reloaded.getState().pending).toEqual([]);
    });

    it('keeps an expense that was edited while its older version was being sent', async () => {
        const { outbox } = await openOutbox();
        const sent = expense('a', { updatedAt: 1 });
        await outbox.put(sent);
        await outbox.put(expense('a', { text: 'edited meanwhile', updatedAt: 2 }));

        await outbox.settle(sent);

        expect(outbox.getState().pending.map((item) => item.text)).toEqual(['edited meanwhile']);
    });

    it('counts a rejected expense and drops it, until the user dismisses the notice', async () => {
        const { outbox } = await openOutbox();
        const sent = expense('a');
        await outbox.put(sent);

        await outbox.reject(sent);

        expect(outbox.getState()).toEqual({ pending: [], rejected: 1 });
        outbox.dismissRejected();
        expect(outbox.getState().rejected).toBe(0);
    });
});
