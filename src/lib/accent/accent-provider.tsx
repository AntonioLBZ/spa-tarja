import { createContext, use, useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { withColorTransition } from '@/lib/theme';

import { applyAccent, readStoredAccent, storeAccent, type Accent } from './accent';

interface AccentContextValue {
    accent: Accent;
    setAccent: (accent: Accent) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

function AccentProvider(props: { children: ReactNode }) {
    const { children } = props;
    const [accent, setAccentState] = useState(readStoredAccent);

    useLayoutEffect(() => {
        applyAccent(accent);
    }, [accent]);

    const setAccent = useCallback((next: Accent) => {
        storeAccent(next);
        withColorTransition(() => flushSync(() => setAccentState(next)));
    }, []);

    const value = useMemo(() => ({ accent, setAccent }), [accent, setAccent]);

    return <AccentContext value={value}>{children}</AccentContext>;
}

function useAccent(): AccentContextValue {
    const value = use(AccentContext);
    if (value === null) throw new Error('useAccent needs an AccentProvider');
    return value;
}

export { AccentProvider, useAccent };
