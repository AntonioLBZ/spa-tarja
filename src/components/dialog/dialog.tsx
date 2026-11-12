import clsx from 'clsx';
import { useEffectEvent, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';

import './dialog.css';

interface DialogProps {
    open: boolean;
    title: string;
    // A sheet holds the form of a task: anchored to the bottom of a phone, the dialog itself from 40 rem
    variant?: 'dialog' | 'sheet';
    // Names the button that closes it, which ends its title row; without it there is none
    closeLabel?: string;
    // Where the focus goes once it is open; the dialog itself when it returns nothing
    initialFocus?: () => HTMLElement | null;
    // False while Escape must not close it, as when something is being sent from inside it
    dismissible?: boolean;
    // The browser closed it, as Escape does
    onClose: () => void;
    // Ghost buttons or links, apart under what it holds
    actions?: ReactNode;
    children: ReactNode;
}

// A box with the notch over the page. The browser keeps the page still behind it: the focus stays inside and Escape
// closes it. Its children stay in the page while it is closed.
const Dialog = (props: DialogProps) => {
    const {
        open,
        title,
        variant = 'dialog',
        closeLabel,
        initialFocus,
        dismissible = true,
        onClose,
        actions,
        children,
    } = props;
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const dialogClsx = clsx('dialog', { 'dialog--sheet': variant === 'sheet' });

    // Not its first action unless the page says so: nobody chose it, and the ring on it would say so
    const focusStart = useEffectEvent((dialog: HTMLDialogElement) => {
        (initialFocus?.() ?? dialog).focus();
    });

    // Before the passive effects of the page, which hand the focus to a row once the sheet is gone: while a modal is
    // open the rest of the page is inert and the focus would not take
    useLayoutEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            focusStart(dialog);
        } else if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            className={dialogClsx}
            tabIndex={-1}
            onCancel={(event) => {
                if (!dismissible) event.preventDefault();
            }}
            onClose={onClose}
        >
            <div className="dialog__head">
                <h2 className="dialog__title" id={titleId}>
                    {title}
                </h2>
                {closeLabel && (
                    <Button
                        ghost
                        glyph
                        className="dialog__close"
                        aria-label={closeLabel}
                        onClick={() => ref.current?.close()}
                    >
                        <Icon name="close" />
                    </Button>
                )}
            </div>
            <div className="dialog__body">{children}</div>
            {actions && <div className="dialog__actions">{actions}</div>}
        </dialog>
    );
};

export { Dialog, type DialogProps };
