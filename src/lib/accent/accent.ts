const ACCENTS = ['gray', 'amber', 'blue', 'green', 'violet', 'pink'] as const;

type Accent = (typeof ACCENTS)[number];

const DEFAULT_ACCENT: Accent = 'gray';

const STORAGE_KEY = 'tarja:accent';

function isAccent(value: unknown): value is Accent {
    return ACCENTS.some((accent) => accent === value);
}

function readStoredAccent(): Accent {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isAccent(stored) ? stored : DEFAULT_ACCENT;
    } catch {
        return DEFAULT_ACCENT;
    }
}

function storeAccent(accent: Accent): void {
    try {
        localStorage.setItem(STORAGE_KEY, accent);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
}

// The default is what the tokens start with, so it needs no attribute
function applyAccent(accent: Accent): void {
    const root = document.documentElement;
    if (accent === DEFAULT_ACCENT) root.removeAttribute('data-accent');
    else root.dataset.accent = accent;
}

export { ACCENTS, DEFAULT_ACCENT, applyAccent, isAccent, readStoredAccent, storeAccent };
export type { Accent };
