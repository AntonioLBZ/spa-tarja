import { createContext, use, useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { applyTheme, readStoredTheme, storeTheme, syncThemeColor, withColorTransition, type Theme } from './theme';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function ThemeProvider(props: { children: ReactNode }) {
    const { children } = props;
    const [theme, setThemeState] = useState(readStoredTheme);

    useLayoutEffect(() => {
        applyTheme(theme);
        syncThemeColor(theme);
    }, [theme]);

    const setTheme = useCallback((next: Theme) => {
        storeTheme(next);
        withColorTransition(() => flushSync(() => setThemeState(next)));
    }, []);

    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

    return <ThemeContext value={value}>{children}</ThemeContext>;
}

function useTheme(): ThemeContextValue {
    const value = use(ThemeContext);
    if (value === null) throw new Error('useTheme needs a ThemeProvider');
    return value;
}

export { ThemeProvider, useTheme };
