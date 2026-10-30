import clsx from 'clsx';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/button/button';
import { readDuration } from '@/lib/motion';

import './toast.css';

// How long a toast stays, not counting the time the pointer or the focus holds it
const SHOW_FOR_MS = 8_000;

interface ToastOptions {
    message: string;
    // What the person can do about it, when there is something to do
    action?: { label: string; onAction: () => void };
}

interface ToastApi {
    // Shows the toast, replacing the one that is showing
    show: (options: ToastOptions) => void;
    dismiss: () => void;
}

interface ShownToast extends ToastOptions {
    id: number;
    // Fading out, about to go
    leaving: boolean;
}

interface ToastBoxProps {
    toast: ShownToast;
    onDismiss: () => void;
}

interface ToastProviderProps {
    children: ReactNode;
}

const ToastContext = createContext<ToastApi | null>(null);

// The toast that is showing, with its count of the time left: hovering it or keeping the focus inside holds the count
const ToastBox = (props: ToastBoxProps) => {
    const { toast, onDismiss } = props;
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const remaining = useRef(SHOW_FOR_MS);
    const counting = !hovered && !focused && !toast.leaving;
    const toastClsx = clsx('toast', { 'toast--leaving': toast.leaving });

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
            onBlur={() => setFocused(false)}
            onFocus={() => setFocused(true)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <p className="toast__message">{toast.message}</p>
            {toast.action && (
                <Button
                    disabled={toast.leaving}
                    onClick={() => {
                        toast.action?.onAction();
                        onDismiss();
                    }}
                >
                    {toast.action.label}
                </Button>
            )}
        </div>
    );
};

// One toast at a time, above the routes so it survives a change of screen. Its `role="status"` region is always in
// the page, after everything else, so a message that comes in is announced and the toast is the last tab stop.
const ToastProvider = (props: ToastProviderProps) => {
    const { children } = props;
    const [toast, setToast] = useState<ShownToast | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const lastId = useRef(0);

    useEffect(() => () => clearTimeout(leaveTimer.current), []);

    const show = useCallback((options: ToastOptions) => {
        clearTimeout(leaveTimer.current);
        setToast({ ...options, id: ++lastId.current, leaving: false });
    }, []);

    // Fades out over the length of the transitions, and goes
    const dismiss = useCallback(() => {
        clearTimeout(leaveTimer.current);
        const duration = readDuration('--duration-base');
        if (duration === 0) {
            setToast(null);
            return;
        }
        setToast((current) => current && { ...current, leaving: true });
        leaveTimer.current = setTimeout(() => setToast(null), duration);
    }, []);

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

    const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

    return (
        <ToastContext value={api}>
            {children}
            <div className="toast-region" role="status">
                {toast && <ToastBox key={toast.id} toast={toast} onDismiss={dismiss} />}
            </div>
        </ToastContext>
    );
};

const useToast = (): ToastApi => {
    const value = use(ToastContext);
    if (value === null) throw new Error('useToast needs a ToastProvider');
    return value;
};

export { ToastProvider, useToast, type ToastApi, type ToastOptions, type ToastProviderProps };
