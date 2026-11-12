import clsx from 'clsx';
import { useEffectEvent, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { DURATION, EASE, MOTION_QUERY, canAnimate, gsap } from '@/lib/motion/gsap';

import './dialog.css';

// A sheet unfolds out of what opened it: a rectangle that grows from the box of that control until it holds the whole
// sheet, and what is inside it follows in a short stagger
const unfold = (dialog: HTMLDialogElement, from: DOMRect) => {
    const box = dialog.getBoundingClientRect();
    const inset = (rect: DOMRect) => {
        const top = Math.max(0, rect.top - box.top);
        const right = Math.max(0, box.right - rect.right);
        const bottom = Math.max(0, box.bottom - rect.bottom);
        const left = Math.max(0, rect.left - box.left);
        return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    };

    gsap.fromTo(
        dialog,
        { clipPath: inset(from) },
        { clipPath: 'inset(0px 0px 0px 0px)', duration: DURATION.slow * 1.4, ease: EASE.enter, clearProps: 'clipPath' }
    );
    gsap.from(dialog.querySelectorAll('.dialog__head, .dialog__body > *, .dialog__actions'), {
        y: 16,
        opacity: 0,
        duration: DURATION.slow,
        ease: EASE.enter,
        stagger: 0.04,
        delay: 0.08,
        clearProps: 'transform,opacity',
    });
};

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
            const trigger = variant === 'sheet' ? document.activeElement : null;
            const from =
                trigger instanceof HTMLElement && trigger !== document.body ? trigger.getBoundingClientRect() : null;
            const animate = from !== null && canAnimate() && window.matchMedia(MOTION_QUERY).matches;
            if (animate) dialog.dataset.unfold = '';
            else delete dialog.dataset.unfold;
            dialog.showModal();
            focusStart(dialog);
            if (animate) unfold(dialog, from);
        } else if (!open && dialog.open) dialog.close();
    }, [open, variant]);

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
