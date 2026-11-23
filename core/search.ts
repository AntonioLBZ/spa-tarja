import { parseAmount } from './money';
import { normalizeText, searchWords } from './text';

// A number typed in the search: the text it would match as words, and the amounts it names, from `cents` and `span`
// cents wide. What is typed is a start, as in a word: 12 is 12.00 to 12.99, 12,3 is 12.30 to 12.39, 12,30 is 12.30 alone.
interface SearchNumber {
    text: string;
    cents: number;
    span: number;
}

// What a search asks: words in the text, numbers in the text or the amounts, and amounts above or below a bound
interface ParsedSearch {
    words: string[];
    numbers: SearchNumber[];
    above: number | null;
    below: number | null;
}

const DECIMALS = /[.,](\d{1,2})$/;

// The symbols an amount can be drawn with (ADR-0028), which a person may type as they see them
const CURRENCY_SYMBOLS = /[€$£¥]/g;

// Reads the search as typed, before it is normalised, which would split `12,30` in two. `>50` and `<10` are bounds on the
// amount (a space after the sign is fine); a word that only looks like one, as `>` alone, is a word.
const parseSearch = (query: string, locale = 'en'): ParsedSearch => {
    const parsed: ParsedSearch = { words: [], numbers: [], above: null, below: null };
    for (const token of query.replace(/([<>])\s+/g, '$1').split(/\s+/)) {
        const bare = token.replace(CURRENCY_SYMBOLS, '');
        const sign = bare[0];
        if (sign === '>' || sign === '<') {
            const cents = parseAmount(bare.slice(1), locale);
            if (cents !== null) {
                if (sign === '>') parsed.above = Math.max(parsed.above ?? cents, cents);
                else parsed.below = Math.min(parsed.below ?? cents, cents);
                continue;
            }
        }
        const cents = /^\d/.test(bare) ? parseAmount(bare, locale) : null;
        if (cents !== null) {
            const decimals = DECIMALS.exec(bare)?.[1]?.length ?? 0;
            parsed.numbers.push({ text: normalizeText(bare), cents, span: 10 ** (2 - decimals) });
            continue;
        }
        parsed.words.push(...searchWords(token));
    }
    return parsed;
};

const numberMatches = (number: SearchNumber, cents: number): boolean => {
    return cents >= number.cents && cents < number.cents + number.span;
};

const isNarrowing = (search: ParsedSearch): boolean => {
    return search.words.length > 0 || search.numbers.length > 0 || search.above !== null || search.below !== null;
};

// Whether a row passes the search: every word is in its normalised text, every number is in the text or names one of
// its amounts, and every bound holds for one same amount. The text and the amounts are asked only when needed.
const searchMatches = (search: ParsedSearch, textOf: () => string, amountsOf: () => readonly number[]): boolean => {
    const { words, numbers, above, below } = search;
    const bounded = above !== null || below !== null;
    const amounts = numbers.length > 0 || bounded ? amountsOf() : [];
    if (bounded && !amounts.some((cents) => (above === null || cents > above) && (below === null || cents < below)))
        return false;
    if (words.length === 0 && numbers.length === 0) return true;
    const text = textOf();
    return (
        words.every((word) => text.includes(word)) &&
        numbers.every((number) => text.includes(number.text) || amounts.some((cents) => numberMatches(number, cents)))
    );
};

export { isNarrowing, parseSearch, searchMatches, type ParsedSearch };
