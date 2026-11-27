import { useCallback, useState } from 'react';

// The face the text is set in: monospace by default, the others for whoever prefers one
const TYPEFACES = ['mono', 'sans', 'legible', 'system'] as const;

type Typeface = (typeof TYPEFACES)[number];

const DEFAULT_TYPEFACE: Typeface = 'mono';

const TYPEFACE_KEY = 'tarja:typeface';

const isTypeface = (value: unknown): value is Typeface => {
    return TYPEFACES.some((typeface) => typeface === value);
};

const readStoredTypeface = (): Typeface => {
    try {
        const stored = localStorage.getItem(TYPEFACE_KEY);
        return isTypeface(stored) ? stored : DEFAULT_TYPEFACE;
    } catch {
        return DEFAULT_TYPEFACE;
    }
};

const storeTypeface = (typeface: Typeface): void => {
    try {
        localStorage.setItem(TYPEFACE_KEY, typeface);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
};

// The default leaves the root bare, as the first paint does
const applyTypeface = (typeface: Typeface): void => {
    if (typeface === DEFAULT_TYPEFACE) {
        document.documentElement.removeAttribute('data-typeface');
        return;
    }
    document.documentElement.dataset.typeface = typeface;
};

const useTypeface = (): [Typeface, (typeface: Typeface) => void] => {
    const [typeface, setTypefaceState] = useState(readStoredTypeface);

    const setTypeface = useCallback((next: Typeface) => {
        storeTypeface(next);
        applyTypeface(next);
        setTypefaceState(next);
    }, []);

    return [typeface, setTypeface];
};

export {
    DEFAULT_TYPEFACE,
    TYPEFACES,
    applyTypeface,
    isTypeface,
    readStoredTypeface,
    storeTypeface,
    useTypeface,
    type Typeface,
};
