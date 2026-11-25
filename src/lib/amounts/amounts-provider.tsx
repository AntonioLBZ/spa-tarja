import { createContext, use, useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

import { useLocale } from '@/lib/i18n';
import { DEFAULT_CURRENCY, formatAmount, formatAmountInput } from '@core/basics/money';

import { applyMoneyPalette, readStoredAmounts, storeAmounts, type AmountPreferences } from './amounts';

interface AmountsContextValue {
    preferences: AmountPreferences;
    setPreferences: (change: Partial<AmountPreferences>) => void;
}

const AmountsContext = createContext<AmountsContextValue | null>(null);

interface AmountsProviderProps {
    children: ReactNode;
}

const AmountsProvider = (props: AmountsProviderProps) => {
    const { children } = props;
    const [preferences, setState] = useState(readStoredAmounts);

    useLayoutEffect(() => {
        applyMoneyPalette(preferences.colorBlind);
    }, [preferences.colorBlind]);

    const setPreferences = useCallback((change: Partial<AmountPreferences>) => {
        setState((current) => {
            const next = { ...current, ...change };
            storeAmounts(next);
            return next;
        });
    }, []);

    const value = useMemo(() => ({ preferences, setPreferences }), [preferences, setPreferences]);

    return <AmountsContext value={value}>{children}</AmountsContext>;
};

const useAmountPreferences = (): AmountsContextValue => {
    const value = use(AmountsContext);
    if (value === null) throw new Error('useAmountPreferences needs an AmountsProvider');
    return value;
};

// Money as the app writes it: the locale's way, with the symbol the person chose for the app's currency. Any other
// currency keeps its own symbol
const useMoney = () => {
    const { locale } = useLocale();
    const { symbol } = useAmountPreferences().preferences;

    return useCallback(
        (cents: number, currency: string = DEFAULT_CURRENCY) =>
            formatAmount(cents, currency, locale, currency === DEFAULT_CURRENCY ? symbol : undefined),
        [locale, symbol]
    );
};

// What an empty amount field shows as an example, zero the way the locale types it: "0.00", "0,00"
const useAmountPlaceholder = () => {
    const { locale } = useLocale();
    return formatAmountInput(0, locale);
};

interface AmountCues {
    // Whether the screen wants color and sign on this amount; the person's settings still decide
    cues?: boolean;
    // Whether it wants the arrow too, which only the balances of a group ask for
    arrow?: boolean;
}

// The props of an `Amount`: the text without its sign, and the cues the screen asks for and the person allows.
// Positive cents add to the balance of whoever the line is about, negative take from it
const useAmount = () => {
    const money = useMoney();
    const { preferences } = useAmountPreferences();

    return useCallback(
        (cents: number, currency: string = DEFAULT_CURRENCY, cues: AmountCues = {}) => ({
            text: money(Math.abs(cents), currency),
            direction: cents === 0 ? undefined : cents > 0 ? ('in' as const) : ('out' as const),
            color: Boolean(cues.cues) && preferences.color,
            sign: Boolean(cues.cues) && preferences.sign,
            arrow: Boolean(cues.cues) && Boolean(cues.arrow) && preferences.arrows,
        }),
        [money, preferences]
    );
};

export {
    AmountsProvider,
    useAmount,
    useAmountPlaceholder,
    useAmountPreferences,
    useMoney,
    type AmountCues,
    type AmountsProviderProps,
};
