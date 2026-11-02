import { describe, expect, it, vi } from 'vitest';

import { createMemoryStorage } from '@/lib/test/memory-storage';

import { GROUP_OUTBOX_STORAGE_KEY, OUTBOX_STORAGE_KEY, createOutbox, type PendingEntry } from './outbox';

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
    const outbox = createOutbox<Expense>(storage, OUTBOX_STORAGE_KEY);
    await outbox.ready;
    return { outbox, storage };
}

describe('outbox', () => {
    it('starts empty', async () => {
        const { outbox } = await openOutbox();

        expect(outbox.getState()).toEqual({ pending: [], rejected: [] });
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

        const reloaded = createOutbox<Expense>(storage, OUTBOX_STORAGE_KEY);
        await reloaded.ready;

        expect(reloaded.getState().pending).toEqual([expense('a')]);
    });

    it('drops a settled expense', async () => {
        const { outbox, storage } = await openOutbox();
        const sent = expense('a');
        await outbox.put(sent);

        await outbox.settle(sent);

        expect(outbox.getState().pending).toEqual([]);
        const reloaded = createOutbox<Expense>(storage, OUTBOX_STORAGE_KEY);
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

    it('drops a rejected expense and keeps it with the reason, until the user dismisses the notice', async () => {
        const { outbox } = await openOutbox();
        const sent = expense('a');
        await outbox.put(sent);

        await outbox.reject(sent, 'id-taken');

        expect(outbox.getState()).toEqual({ pending: [], rejected: [{ item: sent, code: 'id-taken' }] });
        outbox.dismissRejected();
        expect(outbox.getState().rejected).toEqual([]);
    });

    it('keeps a version edited while the older one was being refused, and counts nothing', async () => {
        const { outbox } = await openOutbox();
        const sent = expense('a', { updatedAt: 1 });
        await outbox.put(sent);
        await outbox.put(expense('a', { text: 'edited meanwhile', updatedAt: 2 }));

        await outbox.reject(sent, null);

        expect(outbox.getState().pending.map((item) => item.text)).toEqual(['edited meanwhile']);
        expect(outbox.getState().rejected).toEqual([]);
    });
});

describe('putAll', () => {
    it('holds every expense, in the order given, after what was already pending', async () => {
        const { outbox } = await openOutbox();
        await outbox.put(expense('a'));

        await outbox.putAll([expense('b'), expense('c')]);

        expect(outbox.getState().pending.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });

    it('replaces the entries of expenses that were already there', async () => {
        const { outbox } = await openOutbox();
        await outbox.putAll([expense('a'), expense('b')]);

        await outbox.putAll([expense('b', { text: 'edited', updatedAt: 2 }), expense('c')]);

        expect(outbox.getState().pending.map((item) => [item.id, item.text])).toEqual([
            ['a', 'a'],
            ['b', 'edited'],
            ['c', 'c'],
        ]);
    });

    it('reaches the disk in one write and tells the subscribers once', async () => {
        const storage = createMemoryStorage();
        const set = vi.spyOn(storage, 'set');
        const { outbox } = await openOutbox(storage);
        const listener = vi.fn();
        outbox.subscribe(listener);

        await outbox.putAll([expense('a'), expense('b'), expense('c')]);

        expect(set).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledTimes(1);
        const reloaded = createOutbox<Expense>(storage, OUTBOX_STORAGE_KEY);
        await reloaded.ready;
        expect(reloaded.getState().pending.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });

    it('keeps none of them when the device cannot store them', async () => {
        const storage = { ...createMemoryStorage(), set: () => Promise.reject(new Error('quota exceeded')) };
        const { outbox } = await openOutbox(storage);

        await expect(outbox.putAll([expense('a'), expense('b')])).rejects.toThrow('quota exceeded');

        expect(outbox.getState().pending).toEqual([]);
    });

    it('does nothing for an empty list', async () => {
        const storage = createMemoryStorage();
        const set = vi.spyOn(storage, 'set');
        const { outbox } = await openOutbox(storage);

        await outbox.putAll([]);

        expect(set).not.toHaveBeenCalled();
    });
});

describe('the outbox of the entries of groups', () => {
    const entry: PendingEntry = {
        id: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 500,
        currency: 'EUR',
        date: '2026-10-25',
        paidBy: crypto.randomUUID(),
        split: 'exact',
        shares: [{ memberId: crypto.randomUUID(), cents: 500 }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
    };

    it('lives on the same device apart from the one of the expenses', async () => {
        const storage = createMemoryStorage();
        const expenses = createOutbox<Expense>(storage, OUTBOX_STORAGE_KEY);
        const entries = createOutbox<PendingEntry>(storage, GROUP_OUTBOX_STORAGE_KEY);
        await Promise.all([expenses.ready, entries.ready]);

        await entries.put(entry);
        await expenses.put(expense('a'));

        const [expensesAgain, entriesAgain] = [
            createOutbox<Expense>(storage, OUTBOX_STORAGE_KEY),
            createOutbox<PendingEntry>(storage, GROUP_OUTBOX_STORAGE_KEY),
        ];
        await Promise.all([expensesAgain.ready, entriesAgain.ready]);
        expect(expensesAgain.getState().pending).toEqual([expense('a')]);
        expect(entriesAgain.getState().pending).toEqual([entry]);
        expect(await storage.get('tarja:outbox')).toEqual([expense('a')]);
        expect(await storage.get('tarja:group-outbox')).toEqual([entry]);
    });
});
