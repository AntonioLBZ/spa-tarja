const LOCALES = ['en', 'es'] as const;

type AppLocale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: AppLocale = 'en';

// Each language in its own, so a reader can find theirs whatever the current one is
const LOCALE_NAMES: Record<AppLocale, string> = { en: 'English', es: 'Español' };

const STORAGE_KEY = 'tarja:locale';

function isLocale(value: unknown): value is AppLocale {
    return LOCALES.some((locale) => locale === value);
}

// Stored preference, then the browser's languages, then English
function detectLocale(stored: string | null, languages: readonly string[]): AppLocale {
    if (isLocale(stored)) return stored;
    for (const tag of languages) {
        const language = tag.toLowerCase().split('-')[0];
        if (isLocale(language)) return language;
    }
    return DEFAULT_LOCALE;
}

function readStoredLocale(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function storeLocale(locale: AppLocale): void {
    try {
        localStorage.setItem(STORAGE_KEY, locale);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
}

export { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, detectLocale, isLocale, readStoredLocale, storeLocale };
export type { AppLocale };
