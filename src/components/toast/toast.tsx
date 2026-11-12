import clsx from 'clsx';
import {
    createContext,
    use,
    useCallback,
    useEffect,
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

import './toast.css';

// How long a toast stays, not counting the time the pointer or the focus holds it
const SHOW_FOR_MS = 8_000;

interface ToastAction {
    label: string;
    onAction: () => void;
}

interface ToastOptions {
    message: string;
    // What the person can do about it, when there is something to do
    action?: ToastAction;
}

interface PinnedToastOptions {
    message: string;
    // The answers to it: it stays until one of them is chosen
    actions: readonly ToastAction[];
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
    actions: readonly ToastAction[];
    // Fading out, about to go
    leaving: boolean;
}

interface ToastBoxProps {
    toast: ShownToast;
    pinned?: boolean;
    dismissLabel: string;
    onDismiss: () => void;
}

interface ToastProviderProps {
    // Names the button that clears a toast away; a pinned toast has none
    dismissLabel: string;
    children: ReactNode;
}

type Timer = RefObject<ReturnType<typeof setTimeout> | undefined>;

const ToastContext = createContext<ToastApi | null>(null);

// Fades a toast out over the length of the transitions, and takes it away
const fadeOut = (set: Dispatch<SetStateAction<ShownToast | null>>, timer: Timer) => {
    clearTimeout(timer.current);
    const duration = readDuration('--duration-base');
    if (duration === 0) {
        set(null);
        return;
    }
    set((current) => current && { ...current, leaving: true });
    timer.current = setTimeout(() => set(null), duration);
};

// A toast that goes away by itself keeps its count of the time left: hovering it or keeping the focus inside holds the
// count, and it ends with a button that clears it away. A pinned one has no count and no such button: its answers close
// it.
const ToastBox = (props: ToastBoxProps) => {
    const { toast, pinned, dismissLabel, onDismiss } = props;
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const remaining = useRef(SHOW_FOR_MS);
    const counting = !pinned && !hovered && !focused && !toast.leaving;
    const toastClsx = clsx('toast', {
        'toast--pinned': pinned,
        'toast--held': !pinned && (hovered || focused),
        'toast--leaving': toast.leaving,
    });
    const style = pinned ? undefined : ({ '--toast-duration': `${SHOW_FOR_MS}ms` } as CSSProperties);

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
        >
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
                            onClick={onDismiss}
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

    const show = useCallback((options: ToastOptions) => {
        clearTimeout(leaveTimer.current);
        setToast({
            id: ++lastId.current,
            message: options.message,
            actions: options.action ? [options.action] : [],
            leaving: false,
        });
    }, []);

    const dismiss = useCallback(() => fadeOut(setToast, leaveTimer), []);

    // Pinned again while it is there, it keeps its box instead of coming in a second time
    const pin = useCallback((options: PinnedToastOptions) => {
        clearTimeout(unpinTimer.current);
        const id = ++lastId.current;
        setPinned((current) => ({
            id: current && !current.leaving ? current.id : id,
            message: options.message,
            actions: options.actions,
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

    const api = useMemo(() => ({ show, dismiss, pin, unpin }), [show, dismiss, pin, unpin]);

    return (
        <ToastContext value={api}>
            {children}
            <div className="toast-region" role="status">
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
