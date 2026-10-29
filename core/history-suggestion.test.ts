import { describe, expect, it } from 'vitest';

import { indexHistory, suggestFromHistory } from './history-suggestion';

import type { Expense } from './expense';

const CUSTOM = '5d4a8c4e-2f1a-4c33-8e0e-3d1b2f6a9c11';
const KNOWN = new Set(['food', 'groceries', 'leisure', 'health', 'other', CUSTOM]);
const exists = (categoryId: string) => KNOWN.has(categoryId);

function expense(text: string, categoryId: string, overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId,
        text,
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

function suggest(text: string, history: readonly Expense[], known = exists) {
    return suggestFromHistory(text, indexHistory(history, known));
}

describe('suggestFromHistory', () => {
    it('has nothing to say without a history or without words', () => {
        expect(suggest('padel', [])).toBeNull();
        expect(suggest('', [expense('padel', 'leisure')])).toBeNull();
        expect(suggest('   ', [expense('padel', 'leisure')])).toBeNull();
    });

    it('suggests the category an earlier expense with the same word was filed under', () => {
        expect(suggest('padel', [expense('Padel with Ana', 'leisure')])).toBe('leisure');
    });

    it('finds the word wherever it is in either text', () => {
        expect(suggest('club de padel', [expense('pistas de padel con Ana', 'leisure')])).toBe('leisure');
    });

    it('ignores case and accents on both sides', () => {
        expect(suggest('PADEL', [expense('pádel', 'leisure')])).toBe('leisure');
        expect(suggest('Pádel', [expense('PADEL', 'leisure')])).toBe('leisure');
    });

    it('matches whole words only', () => {
        expect(suggest('padel', [expense('padelista', 'leisure')])).toBeNull();
        expect(suggest('padelista', [expense('padel', 'leisure')])).toBeNull();
    });

    it('counts a word that has at least 4 letters, and no shorter one', () => {
        expect(suggest('yoga', [expense('yoga', 'health')])).toBe('health');
        expect(suggest('gym', [expense('gym', 'health')])).toBeNull();
    });

    it('does not count numbers, or what mixes letters and numbers', () => {
        expect(suggest('2026', [expense('2026', 'leisure')])).toBeNull();
        expect(suggest('room101', [expense('room101', 'leisure')])).toBeNull();
    });

    it('ignores a word seen in more than one category, which drops the filler', () => {
        const history = [expense('lunch with Ana', 'food'), expense('movie with Ana', 'leisure')];

        expect(suggest('padel with Ana', history)).toBeNull();
        expect(suggest('lunch with Bob', history)).toBe('food');
    });

    it('needs every earlier expense with the word to agree', () => {
        const history = [expense('padel', 'leisure'), expense('padel', 'leisure'), expense('padel club', 'food')];

        expect(suggest('padel', history)).toBeNull();
    });

    it('lets the category with the most such words win', () => {
        const history = [
            expense('padel court', 'leisure'),
            expense('pistas club', 'leisure'),
            expense('raquetas', CUSTOM),
        ];

        expect(suggest('padel pistas raquetas', history)).toBe('leisure');
    });

    it('breaks a tie with the category that has the most earlier expenses with those words', () => {
        const history = [
            expense('alpha', 'leisure'),
            expense('beta', 'health'),
            expense('beta', 'health'),
            expense('beta', 'health'),
        ];

        expect(suggest('alpha beta', history)).toBe('health');
        expect(suggest('beta alpha', history)).toBe('health');
    });

    it('counts a plan once, however many payments it has', () => {
        const plan = { id: crypto.randomUUID(), parts: 3 };
        const history = [
            ...[1, 2, 3].map((part) => expense('alpha', 'leisure', { plan: { ...plan, part } })),
            expense('beta', 'health'),
            expense('beta', 'health'),
        ];

        expect(suggest('alpha beta', history)).toBe('health');
    });

    it('breaks the last tie the same way every time, by the id of the category', () => {
        const history = [expense('alpha', 'leisure'), expense('beta', 'health')];

        expect(suggest('alpha beta', history)).toBe('health');
        expect(suggest('beta alpha', history)).toBe('health');
        expect(suggest('alpha beta', history.toReversed())).toBe('health');
    });

    it('can suggest a custom category', () => {
        expect(suggest('crossfit', [expense('crossfit Monday', CUSTOM)])).toBe(CUSTOM);
    });

    it('skips an expense that was deleted', () => {
        expect(suggest('padel', [expense('padel', 'leisure', { deletedAt: 5_000 })])).toBeNull();
    });

    it('skips a category that no longer exists, so its words say nothing', () => {
        const gone = crypto.randomUUID();

        expect(suggest('crossfit', [expense('crossfit', gone)])).toBeNull();
    });

    it('does not let a category that no longer exists make a word look ambiguous', () => {
        const gone = crypto.randomUUID();
        const history = [expense('crossfit', gone), expense('crossfit', 'health')];

        expect(suggest('crossfit', history)).toBe('health');
    });

    it('can suggest other, which is a category like any other', () => {
        expect(suggest('stuff', [expense('stuff', 'other')])).toBe('other');
    });

    it('does not change the history it is given', () => {
        const history = [expense('padel', 'leisure')];
        const before = structuredClone(history);

        suggest('padel', history);

        expect(history).toEqual(before);
    });
});

describe('indexHistory', () => {
    it('can be asked many times', () => {
        const index = indexHistory([expense('padel', 'leisure'), expense('yoga', 'health')], exists);

        expect(suggestFromHistory('padel', index)).toBe('leisure');
        expect(suggestFromHistory('yoga', index)).toBe('health');
        expect(suggestFromHistory('padel', index)).toBe('leisure');
    });
});
