import { createContext, use, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import {
    applyDarkTone,
    applyTheme,
    readStoredDarkTone,
    readStoredTheme,
    resolveTheme,
    revealTheme,
    storeDarkTone,
    storeTheme,
    syncThemeColor,
    type DarkTone,
    type Theme,
} from './theme';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    darkTone: DarkTone;
    setDarkTone: (tone: DarkTone) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
    children: ReactNode;
}

const ThemeProvider = (props: ThemeProviderProps) => {
    const { children } = props;
    const [theme, setThemeState] = useState(readStoredTheme);
    const [darkTone, setDarkToneState] = useState(readStoredDarkTone);

    const current = useRef(theme);

    useLayoutEffect(() => {
        current.current = theme;
        applyTheme(theme);
        applyDarkTone(darkTone);
        syncThemeColor(theme, darkTone);
    }, [theme, darkTone]);

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

    const setDarkTone = useCallback((next: DarkTone) => {
        storeDarkTone(next);
        const update = () => flushSync(() => setDarkToneState(next));
        // The tone shows only while the page is dark
        if (resolveTheme(current.current) === 'dark') {
            revealTheme(update);
            return;
        }
        update();
    }, []);

    const value = useMemo(() => ({ theme, setTheme, darkTone, setDarkTone }), [theme, setTheme, darkTone, setDarkTone]);

    return <ThemeContext value={value}>{children}</ThemeContext>;
};

const useTheme = (): ThemeContextValue => {
    const value = use(ThemeContext);
    if (value === null) throw new Error('useTheme needs a ThemeProvider');
    return value;
};

export { ThemeProvider, useTheme, type ThemeProviderProps };
