import { normalizeText } from './text';

import type { Expense } from './expense';

// A shorter word says too little about a category, and is usually filler
const MIN_WORD_LETTERS = 4;

const WORD = new RegExp(`^\\p{L}{${MIN_WORD_LETTERS},}$`, 'u');

// Each word, then the categories earlier expenses with it were filed under, each with those expenses. A plan counts as
// one expense, whatever its number of payments.
type HistoryIndex = ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>;

// The words of a text that count: whole, in letters only and at least `MIN_WORD_LETTERS` of them
const wordsOf = (text: string): Set<string> => {
    return new Set(
        normalizeText(text)
            .split(' ')
            .filter((word) => WORD.test(word))
    );
};

// What the earlier expenses say about each word. Deleted expenses and categories that no longer exist say nothing.
const indexHistory = (expenses: readonly Expense[], exists: (categoryId: string) => boolean): HistoryIndex => {
    const index = new Map<string, Map<string, Set<string>>>();

    for (const expense of expenses) {
        if (expense.deletedAt !== null || !exists(expense.categoryId)) continue;
        const key = expense.plan?.id ?? expense.id;
        for (const word of wordsOf(expense.text)) {
            const byCategory = index.get(word) ?? new Map<string, Set<string>>();
            const keys = byCategory.get(expense.categoryId) ?? new Set<string>();
            keys.add(key);
            byCategory.set(expense.categoryId, keys);
            index.set(word, byCategory);
        }
    }
    return index;
};

// The category of the earlier expenses that share words with the text, or null. A word votes for a category only when
// every earlier expense with it is in that one. The category with the most words wins; on a tie, the one with the most
// expenses behind them, and then the first by id so the answer never depends on the order of the history.
const suggestFromHistory = (text: string, index: HistoryIndex): string | null => {
    const votes = new Map<string, { words: number; expenses: Set<string> }>();

    for (const word of wordsOf(text)) {
        const byCategory = index.get(word);
        if (byCategory?.size !== 1) continue;
        const [[categoryId, keys]] = [...byCategory] as [[string, ReadonlySet<string>]];
        const vote = votes.get(categoryId) ?? { words: 0, expenses: new Set<string>() };
        vote.words += 1;
        for (const key of keys) vote.expenses.add(key);
        votes.set(categoryId, vote);
    }

    const ranked = [...votes].sort(
        ([idA, a], [idB, b]) =>
            b.words - a.words || b.expenses.size - a.expenses.size || (idA < idB ? -1 : idA > idB ? 1 : 0)
    );
    return ranked[0]?.[0] ?? null;
};

export { indexHistory, suggestFromHistory, type HistoryIndex };
