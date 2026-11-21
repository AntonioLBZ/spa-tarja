import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Announce = (message: string) => void;

// A beat between clearing the region and filling it, so a message said twice in a row is still read
const GAP_MS = 100;

const AnnouncerContext = createContext<Announce>(() => undefined);

interface AnnouncerProviderProps {
    children: ReactNode;
}

// A polite status that is always in the page, hidden on screen, through which anything says a message that has no
// place of its own (a screen that opened, something done with no toast). A live region that arrives already filled is
// announced inconsistently, so the text changes inside this one.
const AnnouncerProvider = (props: AnnouncerProviderProps) => {
    const { children } = props;
    const [message, setMessage] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    const announce = useCallback<Announce>((next) => {
        clearTimeout(timer.current);
        setMessage('');
        timer.current = setTimeout(() => setMessage(next), GAP_MS);
    }, []);

    return (
        <AnnouncerContext value={announce}>
            {children}
            <div className="visually-hidden" role="status">
                {message}
            </div>
        </AnnouncerContext>
    );
};

// Says nothing without a provider, as on the sign-in screen
const useAnnounce = (): Announce => use(AnnouncerContext);

export { AnnouncerProvider, useAnnounce, type Announce, type AnnouncerProviderProps };
