import clsx from 'clsx';
import {
    createContext,
    use,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type Dispatch,
    type ReactNode,
    type RefObject,
    type SetStateAction,
} from 'react';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { readDuration } from '@/lib/motion';
import { useKeyboardFocus } from '@/lib/use-focus-source';
import { useSwipeAway, type SwipeSide } from '@/lib/use-swipe-away';

import type { IconName } from '@/components/icon/icon-paths';

import './toast.css';

// How long a toast stays, not counting the time the pointer or the focus holds it
const SHOW_FOR_MS = 8_000;

// Back toward the edge it came from, or to a side (ADR-0037)
const SWIPED_TO: readonly SwipeSide[] = ['left', 'right', 'down'];

interface ToastAction {
    label: string;
    onAction: () => void;
}

interface ToastOptions {
    message: string;
    // A bare mark in front of the message, for something that was done
    icon?: IconName;
    // What the person can do about it, when there is something to do
    action?: ToastAction;
}

interface PinnedToastOptions {
    message: string;
    // The answers to it: it stays until one of them is chosen
    actions: readonly ToastAction[];
    // The answer a swipe gives; without it the toast is not swiped away (ADR-0037)
    onSwipeAway?: () => void;
}

interface ToastApi {
    // Shows the toast, replacing the one that is showing
    show: (options: ToastOptions) => void;
    dismiss: () => void;
    // Shows the one that stays until it is answered, above the other one, replacing only another pinned toast
    pin: (options: PinnedToastOptions) => void;
    unpin: () => void;
}

interface ShownToast {
    id: number;
    message: string;
    icon?: IconName;
    actions: readonly ToastAction[];
    onSwipeAway?: () => void;
    // Fading out, about to go
    leaving: boolean;
}

interface ToastBoxProps {
    toast: ShownToast;
    pinned?: boolean;
    dismissLabel: string;
    onDismiss: (swiped?: boolean) => void;
}

interface ToastProviderProps {
    // Names the button that clears a toast away; a pinned toast has none
    dismissLabel: string;
    children: ReactNode;
}

type Timer = RefObject<ReturnType<typeof setTimeout> | undefined>;

const ToastContext = createContext<ToastApi | null>(null);

// Fades a toast out over the length of the transitions, and takes it away
const fadeOut = (set: Dispatch<SetStateAction<ShownToast | null>>, timer: Timer, swiped = false) => {
    clearTimeout(timer.current);
    const duration = readDuration('--duration-base');
    // Swiped away, the finger already took it out: it goes where it was let go
    if (duration === 0 || swiped) {
        set(null);
        return;
    }
    set((current) => current && { ...current, leaving: true });
    timer.current = setTimeout(() => set(null), duration);
};

// A toast that goes away by itself keeps its count of the time left: hovering it or keeping the focus inside holds the
// count, and it ends with a button that clears it away; it can be swiped away too, which holds the count while it is
// dragged. While the keyboard is what moves the focus, one that offers an action doesn't count at all: the way to its
// button is the tab order, which a few seconds can't be trusted to cover. It stays until it is answered, replaced or
// cleared, and counts its whole time from the moment a pointer is used again. A pinned one has no count and no such
// button: its answers close it, and so does a swipe when it names what a swipe answers.
const ToastBox = (props: ToastBoxProps) => {
    const { toast, pinned, dismissLabel, onDismiss } = props;
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const remaining = useRef(SHOW_FOR_MS);
    const swipeAway = () => {
        if (pinned) toast.onSwipeAway?.();
        onDismiss(true);
    };
    const swipes = !pinned || toast.onSwipeAway !== undefined;
    const swipe = useSwipeAway({ sides: SWIPED_TO, onAway: swipeAway, on: swipes && !toast.leaving });
    const keyboard = useKeyboardFocus();
    const kept = !pinned && keyboard && toast.actions.length > 0;
    const counting = !pinned && !hovered && !focused && !swipe.dragged && !toast.leaving && !kept;
    const toastClsx = clsx('toast', {
        'toast--pinned': pinned,
        'toast--kept': kept,
        'toast--held': !pinned && (hovered || focused || swipe.dragged),
        'toast--dragged': swipe.dragged,
        'toast--leaving': toast.leaving,
    });
    const style = (pinned ? swipe.style : { '--toast-duration': `${SHOW_FOR_MS}ms`, ...swipe.style }) as CSSProperties;

    useEffect(() => {
        if (kept) remaining.current = SHOW_FOR_MS;
    }, [kept]);

    useEffect(() => {
        if (!counting) return;
        const startedAt = Date.now();
        const timer = setTimeout(onDismiss, remaining.current);
        return () => {
            clearTimeout(timer);
            remaining.current -= Date.now() - startedAt;
        };
    }, [counting, onDismiss]);

    return (
        <div
            className={toastClsx}
            style={style}
            onBlur={() => setFocused(false)}
            onFocus={() => setFocused(true)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            {...swipe.handlers}
        >
            {toast.icon && (
                <span className="toast__mark">
                    <Icon name={toast.icon} />
                </span>
            )}
            <p className="toast__message">{toast.message}</p>
            {(toast.actions.length > 0 || !pinned) && (
                <div className="toast__actions">
                    {toast.actions.map((action) => (
                        <Button
                            ghost
                            disabled={toast.leaving}
                            key={action.label}
                            onClick={() => {
                                action.onAction();
                                onDismiss();
                            }}
                        >
                            {action.label}
                        </Button>
                    ))}
                    {!pinned && (
                        <Button
                            ghost
                            glyph
                            className="toast__dismiss"
                            disabled={toast.leaving}
                            aria-label={dismissLabel}
                            onClick={() => onDismiss()}
                        >
                            <Icon name="close" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

// One toast of each kind at a time, above the routes so it survives a change of screen. Its `role="status"` region is
// always in the page, after everything else, so a message that comes in is announced and the toast is the last tab stop.
const ToastProvider = (props: ToastProviderProps) => {
    const { dismissLabel, children } = props;
    const [toast, setToast] = useState<ShownToast | null>(null);
    const [pinned, setPinned] = useState<ShownToast | null>(null);
    const region = useRef<HTMLDivElement>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const unpinTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const lastId = useRef(0);

    useEffect(
        () => () => {
            clearTimeout(leaveTimer.current);
            clearTimeout(unpinTimer.current);
        },
        []
    );

    // While a toast is up, the room it takes goes into `--toast-height`, so what is brought into view by the focus stops
    // above it instead of under it
    useLayoutEffect(() => {
        const element = region.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const root = document.documentElement;
        const measure = () => {
            if (element.childElementCount === 0) root.style.removeProperty('--toast-height');
            else root.style.setProperty('--toast-height', `${element.getBoundingClientRect().height}px`);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => {
            observer.disconnect();
            root.style.removeProperty('--toast-height');
        };
    }, []);

    const show = useCallback((options: ToastOptions) => {
        clearTimeout(leaveTimer.current);
        setToast({
            id: ++lastId.current,
            message: options.message,
            icon: options.icon,
            actions: options.action ? [options.action] : [],
            leaving: false,
        });
    }, []);

    const dismiss = useCallback((swiped?: boolean) => fadeOut(setToast, leaveTimer, swiped), []);

    // Pinned again while it is there, it keeps its box instead of coming in a second time
    const pin = useCallback((options: PinnedToastOptions) => {
        clearTimeout(unpinTimer.current);
        const id = ++lastId.current;
        setPinned((current) => ({
            id: current && !current.leaving ? current.id : id,
            message: options.message,
            actions: options.actions,
            onSwipeAway: options.onSwipeAway,
            leaving: false,
        }));
    }, []);

    const unpin = useCallback(() => fadeOut(setPinned, unpinTimer), []);

    const open = toast !== null && !toast.leaving;
    useEffect(() => {
        if (!open) return;
        // A control that uses Escape, like an open list, takes the key first
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) dismiss();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [open, dismiss]);

    const api = useMemo(() => ({ show, dismiss: () => dismiss(), pin, unpin }), [show, dismiss, pin, unpin]);

    return (
        <ToastContext value={api}>
            {children}
            <div ref={region} className="toast-region" role="status">
                {pinned && (
                    <ToastBox key={pinned.id} pinned dismissLabel={dismissLabel} toast={pinned} onDismiss={unpin} />
                )}
                {toast && <ToastBox key={toast.id} dismissLabel={dismissLabel} toast={toast} onDismiss={dismiss} />}
            </div>
        </ToastContext>
    );
};

const useToast = (): ToastApi => {
    const value = use(ToastContext);
    if (value === null) throw new Error('useToast needs a ToastProvider');
    return value;
};

export {
    ToastProvider,
    useToast,
    type PinnedToastOptions,
    type ToastAction,
    type ToastApi,
    type ToastOptions,
    type ToastProviderProps,
};
