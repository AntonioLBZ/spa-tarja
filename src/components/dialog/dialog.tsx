import clsx from 'clsx';
import { useEffectEvent, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';

import './dialog.css';

interface DialogProps {
    open: boolean;
    title: string;
    // A sheet holds the form of a task: anchored to the bottom of a phone, the dialog itself from 40 rem. A page is a
    // sheet that takes the whole screen of a phone, with the way back at the start of its title row (ADR-0026)
    variant?: 'dialog' | 'sheet' | 'page';
    // Names the button that closes it, which ends its title row; without it there is none
    closeLabel?: string;
    // Where the focus goes once it is open; the dialog itself when it returns nothing
    initialFocus?: () => HTMLElement | null;
    // False while Escape must not close it, as when something is being sent from inside it
    dismissible?: boolean;
    // False for a form that closing would end, so a stray tap on the veil loses nothing
    closeOnOutside?: boolean;
    // The browser closed it, as Escape does
    onClose: () => void;
    // Ghost buttons or links, apart under what it holds
    actions?: ReactNode;
    // The main action of a page, which ends its title row
    headAction?: ReactNode;
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
        closeOnOutside = true,
        onClose,
        actions,
        headAction,
        children,
    } = props;
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    // Where the press started: one that starts in the box and ends on the veil, as a text selection does, is no tap outside
    const pressedOutside = useRef(false);
    const isPage = variant === 'page';
    const dialogClsx = clsx('dialog', { 'dialog--sheet': variant === 'sheet', 'dialog--page': isPage });
    const closeClsx = clsx('dialog__close', { 'dialog__close--back': isPage });

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

    // The veil is the dialog itself as an event target, so a press on it lands outside the box
    const isOutside = (event: { target: EventTarget; clientX: number; clientY: number }) => {
        const dialog = ref.current;
        if (!dialog || event.target !== dialog) return false;
        const box = dialog.getBoundingClientRect();
        return (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
        );
    };

    const closeButton = closeLabel && (
        <Button ghost glyph className={closeClsx} aria-label={closeLabel} onClick={() => ref.current?.close()}>
            <Icon name={isPage ? 'chevron_left' : 'close'} />
        </Button>
    );

    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            className={dialogClsx}
            tabIndex={-1}
            onCancel={(event) => {
                if (!dismissible) event.preventDefault();
            }}
            onClick={(event) => {
                const outside = pressedOutside.current && isOutside(event);
                pressedOutside.current = false;
                if (outside && dismissible && closeOnOutside) ref.current?.close();
            }}
            onClose={onClose}
            onPointerDown={(event) => {
                pressedOutside.current = isOutside(event);
            }}
        >
            <div className="dialog__head">
                {isPage && closeButton}
                <h2 className="dialog__title" id={titleId}>
                    {title}
                </h2>
                {!isPage && closeButton}
                {isPage && headAction}
            </div>
            <div className="dialog__body">{children}</div>
            {actions && <div className="dialog__actions">{actions}</div>}
        </dialog>
    );
};

export { Dialog, type DialogProps };
