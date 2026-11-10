import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sampleEntry, sampleGroup } from '@/lib/test/groups';

import { ExpenseSheetProvider, useExpenseSheet } from './expense-sheet-state';

import type { SharedRowSource } from '@/features/groups/use-shared-expense-rows';
import type { Expense } from '@core/expense';

const expense = (id: string): Expense => {
    return {
        id,
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
    };
};

const sourceOf = (): SharedRowSource => {
    const group = sampleGroup();
    const entry = sampleEntry(group);
    if (entry.kind !== 'expense') throw new Error('an expense was expected');
    return { group, entry: { ...entry, createdBy: null, updatedBy: null } };
};

const setup = () => renderHook(() => useExpenseSheet(), { wrapper: ExpenseSheetProvider });

describe('ExpenseSheetProvider', () => {
    it('starts closed, adding', () => {
        const { result } = setup();

        expect(result.current.open).toBe(false);
        expect(result.current.editing).toBeNull();
        expect(result.current.copying).toBeNull();
        expect(result.current.editingEntry).toBeNull();
        expect(result.current.copyingEntry).toBeNull();
    });

    it('throws outside its provider', () => {
        expect(() => renderHook(() => useExpenseSheet())).toThrow('useExpenseSheet needs an ExpenseSheetProvider');
    });

    it('opens on openAdd and closes on close', () => {
        const { result } = setup();

        act(() => result.current.openAdd());
        expect(result.current.open).toBe(true);

        act(() => result.current.close());
        expect(result.current.open).toBe(false);
    });

    it('opens with the expense on startEdit and with the copy on startCopy', () => {
        const parts = [expense('a')];
        const { result } = setup();

        act(() => result.current.startEdit(parts));
        expect(result.current.open).toBe(true);
        expect(result.current.editing).toBe(parts);

        act(() => result.current.startCopy(parts));
        expect(result.current.editing).toBeNull();
        expect(result.current.copying?.parts).toBe(parts);
    });

    it('ends an edit when it is closed: back to adding, with the row to take the focus', () => {
        const { result } = setup();

        act(() => result.current.startEdit([expense('a')]));
        act(() => result.current.close());

        expect(result.current.open).toBe(false);
        expect(result.current.editing).toBeNull();
        expect(result.current.refocus).toBe('a');
    });

    it('ends a copy when it is closed, with the row it was copied from to take the focus', () => {
        const { result } = setup();

        act(() => result.current.startCopy([expense('a')]));
        act(() => result.current.close());

        expect(result.current.open).toBe(false);
        expect(result.current.copying).toBeNull();
        expect(result.current.refocus).toBe('a');
    });

    it('ends the edit and the copy of a shared expense when it is closed', () => {
        const source = sourceOf();
        const { result } = setup();

        act(() => result.current.startEditEntry(source));
        expect(result.current.editingEntry).toBe(source);
        act(() => result.current.close());
        expect(result.current.editingEntry).toBeNull();
        expect(result.current.refocus).toBe(source.entry.id);

        act(() => result.current.startCopyEntry(source));
        expect(result.current.copyingEntry?.entry).toBe(source.entry);
        act(() => result.current.close());
        expect(result.current.copyingEntry).toBeNull();
    });

    it('closes the sheet when an edit or a copy ends', () => {
        const { result } = setup();

        act(() => result.current.startEdit([expense('a')]));
        act(() => result.current.endEdit());
        expect(result.current.open).toBe(false);

        act(() => result.current.startCopy([expense('a')]));
        act(() => result.current.endCopy({ refocus: true }));
        expect(result.current.open).toBe(false);
        expect(result.current.refocus).toBe('a');
    });

    it('leaves an open add alone when there is nothing to end', () => {
        const { result } = setup();

        act(() => result.current.openAdd());
        act(() => result.current.endEdit());
        act(() => result.current.endCopy());

        expect(result.current.open).toBe(true);
    });

    it('adds on openAdd after an edit', () => {
        const { result } = setup();

        act(() => result.current.startEdit([expense('a')]));
        act(() => result.current.openAdd());

        expect(result.current.editing).toBeNull();
        expect(result.current.open).toBe(true);
    });

    it('starts a fresh form on openAdd while nothing is typed', () => {
        const { result } = setup();
        const before = result.current.addKey;

        act(() => result.current.openAdd());

        expect(result.current.addKey).toBeGreaterThan(before);
    });

    it('keeps the form on openAdd while it holds a draft', () => {
        const { result } = setup();

        act(() => result.current.openAdd());
        act(() => result.current.markDraft(true));
        const kept = result.current.addKey;
        act(() => result.current.close());
        act(() => result.current.openAdd());

        expect(result.current.addKey).toBe(kept);
        expect(result.current.open).toBe(true);
    });

    it('starts a fresh form again once the draft is gone', () => {
        const { result } = setup();

        act(() => result.current.openAdd());
        act(() => result.current.markDraft(true));
        act(() => result.current.markDraft(false));
        const before = result.current.addKey;
        act(() => result.current.openAdd());

        expect(result.current.addKey).toBeGreaterThan(before);
    });

    it('closes and starts a new form when an add is over', () => {
        const { result } = setup();

        act(() => result.current.openAdd());
        const before = result.current.addKey;
        act(() => result.current.endAdd());

        expect(result.current.open).toBe(false);
        expect(result.current.addKey).toBeGreaterThan(before);
    });

    it('forgets only the edit or copy of the expense that was deleted', () => {
        const { result } = setup();

        act(() => result.current.startEdit([expense('a')]));
        act(() => result.current.forget('b'));
        expect(result.current.editing).not.toBeNull();

        act(() => result.current.forget('a'));
        expect(result.current.editing).toBeNull();
        expect(result.current.open).toBe(false);
    });

    it('keeps the day of the last expense added, for the list to watch', () => {
        const { result } = setup();

        act(() => result.current.noteAdded('2026-10-25'));

        expect(result.current.added).toEqual({ day: '2026-10-25' });
    });
});
