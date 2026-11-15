// The symbols a person can have the app draw for its currency (ADR-0028); the first is the currency's own
const CURRENCY_SYMBOLS = ['€', '$', '£', '¥'] as const;

type CurrencySymbol = (typeof CURRENCY_SYMBOLS)[number];

// How amounts show which way they go, and the symbol they are drawn with: preferences of the device, like the theme
interface AmountPreferences {
    color: boolean;
    sign: boolean;
    arrows: boolean;
    // Blue and orange instead of green and red
    colorBlind: boolean;
    symbol: CurrencySymbol;
}

const DEFAULT_AMOUNT_PREFERENCES: AmountPreferences = {
    color: true,
    sign: true,
    arrows: true,
    colorBlind: false,
    symbol: '€',
};

const STORAGE_KEY = 'tarja:amounts';

const isCurrencySymbol = (value: unknown): value is CurrencySymbol => {
    return CURRENCY_SYMBOLS.some((symbol) => symbol === value);
};

// Each field on its own: a value that isn't what it should be falls back to its default, the others stay
const readStoredAmounts = (): AmountPreferences => {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        const record = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
        const flag = (key: 'color' | 'sign' | 'arrows' | 'colorBlind') => {
            const value = record[key];
            return typeof value === 'boolean' ? value : DEFAULT_AMOUNT_PREFERENCES[key];
        };
        return {
            color: flag('color'),
            sign: flag('sign'),
            arrows: flag('arrows'),
            colorBlind: flag('colorBlind'),
            symbol: isCurrencySymbol(record.symbol) ? record.symbol : DEFAULT_AMOUNT_PREFERENCES.symbol,
        };
    } catch {
        return DEFAULT_AMOUNT_PREFERENCES;
    }
};

const storeAmounts = (preferences: AmountPreferences): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
};

// The palette for color blindness redefines the amount colors from the root
const applyMoneyPalette = (colorBlind: boolean): void => {
    const root = document.documentElement;
    if (colorBlind) root.dataset.moneyPalette = 'color-blind';
    else root.removeAttribute('data-money-palette');
};

export {
    CURRENCY_SYMBOLS,
    DEFAULT_AMOUNT_PREFERENCES,
    applyMoneyPalette,
    isCurrencySymbol,
    readStoredAmounts,
    storeAmounts,
    type AmountPreferences,
    type CurrencySymbol,
};
