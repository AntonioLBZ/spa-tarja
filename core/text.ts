// Lowercase, no accents, and every run of punctuation collapsed into one space
const normalizeText = (text: string): string => {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
};

// The words of a search, normalised
const searchWords = (query: string): string[] => {
    const normalized = normalizeText(query);
    return normalized === '' ? [] : normalized.split(' ');
};

// A character that leaves a mark: not a space, a control, or a format or other ignorable character (zero-width ones)
const VISIBLE = /[^\s\p{Z}\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

// Whether a name shows anything at all
const isVisibleText = (text: string): boolean => {
    return VISIBLE.test(text);
};

export { isVisibleText, normalizeText, searchWords };
