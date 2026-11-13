import { createContext, use, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import {
    applyTheme,
    readStoredTheme,
    resolveTheme,
    revealTheme,
    storeTheme,
    syncThemeColor,
    type Theme,
} from './theme';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
    children: ReactNode;
}

const ThemeProvider = (props: ThemeProviderProps) => {
    const { children } = props;
    const [theme, setThemeState] = useState(readStoredTheme);

    const current = useRef(theme);

    useLayoutEffect(() => {
        current.current = theme;
        applyTheme(theme);
        syncThemeColor(theme);
    }, [theme]);

    const setTheme = useCallback((next: Theme) => {
        storeTheme(next);
        const update = () => flushSync(() => setThemeState(next));
        // Between two themes that look the same, as System on a dark device and Dark, there is nothing to reveal
        if (resolveTheme(current.current) === resolveTheme(next)) {
            update();
            return;
        }
        revealTheme(update);
    }, []);

    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

    return <ThemeContext value={value}>{children}</ThemeContext>;
};

const useTheme = (): ThemeContextValue => {
    const value = use(ThemeContext);
    if (value === null) throw new Error('useTheme needs a ThemeProvider');
    return value;
};

export { ThemeProvider, useTheme, type ThemeProviderProps };
