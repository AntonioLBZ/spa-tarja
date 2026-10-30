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

export { normalizeText, searchWords };
