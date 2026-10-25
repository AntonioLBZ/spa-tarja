import { DEFAULT_CATEGORY_IDS, FALLBACK_CATEGORY_ID, type DefaultCategoryId } from './categories';
import { CATEGORY_KEYWORDS } from './category-keywords';

interface Entry {
    category: DefaultCategoryId;
    // The keyword and its plural forms, each framed by spaces so only whole words match
    forms: string[];
    // Words in the keyword: a phrase outweighs a single word
    weight: number;
}

// Lowercase, no accents, and every run of punctuation collapsed into one space
function normalizeText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

const ENTRIES: Entry[] = DEFAULT_CATEGORY_IDS.flatMap((category) =>
    category === FALLBACK_CATEGORY_ID
        ? []
        : CATEGORY_KEYWORDS[category].map((keyword) => {
              const normalized = normalizeText(keyword);
              return {
                  category,
                  forms: [normalized, `${normalized}s`, `${normalized}es`].map((form) => ` ${form} `),
                  weight: normalized.split(' ').length,
              };
          })
);

// The category whose keywords match the most words; on a tie, the first one in the default order
function suggestCategory(text: string): DefaultCategoryId {
    const padded = ` ${normalizeText(text)} `;
    const scores = new Map<DefaultCategoryId, number>();

    for (const { category, forms, weight } of ENTRIES) {
        if (forms.some((form) => padded.includes(form))) scores.set(category, (scores.get(category) ?? 0) + weight);
    }

    let best: DefaultCategoryId = FALLBACK_CATEGORY_ID;
    let bestScore = 0;
    for (const category of DEFAULT_CATEGORY_IDS) {
        const score = scores.get(category) ?? 0;
        if (score > bestScore) {
            best = category;
            bestScore = score;
        }
    }
    return best;
}

export { suggestCategory };
