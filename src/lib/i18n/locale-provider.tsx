import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { IntlProvider } from 'use-intl';

import { detectLocale, readStoredLocale, storeLocale, type AppLocale } from './locale';
import { MESSAGES } from './messages';

interface LocaleContextValue {
    locale: AppLocale;
    setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
    children: ReactNode;
}

const LocaleProvider = (props: LocaleProviderProps) => {
    const { children } = props;
    const [locale, setLocaleState] = useState(() => detectLocale(readStoredLocale(), navigator.languages));

    useEffect(() => {
        document.documentElement.lang = locale;
        // The static HTML carries the English one, for readers that run no script
        document
            .querySelector('meta[name="description"]')
            ?.setAttribute('content', MESSAGES[locale].metadata.description);
    }, [locale]);

    const setLocale = useCallback((next: AppLocale) => {
        storeLocale(next);
        setLocaleState(next);
    }, []);

    const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

    return (
        <LocaleContext value={value}>
            <IntlProvider locale={locale} messages={MESSAGES[locale]}>
                {children}
            </IntlProvider>
        </LocaleContext>
    );
};

const useLocale = (): LocaleContextValue => {
    const value = use(LocaleContext);
    if (value === null) throw new Error('useLocale needs a LocaleProvider');
    return value;
};

export { LocaleProvider, useLocale, type LocaleProviderProps };
