import { useEffect, useId, useRef, type ReactNode } from 'react';

import './dialog.css';

interface DialogProps {
    open: boolean;
    title: string;
    // The browser closed it, as Escape does
    onClose: () => void;
    // Ghost buttons or links, apart under what it holds
    actions?: ReactNode;
    children: ReactNode;
}

// A box with the notch over the page. The browser keeps the page still behind it: the focus stays inside and Escape
// closes it.
const Dialog = (props: DialogProps) => {
    const { open, title, onClose, actions, children } = props;
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            // Not its first action: nobody chose it, and the ring on it would say so
            dialog.focus();
        } else if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog ref={ref} aria-labelledby={titleId} className="dialog" tabIndex={-1} onClose={onClose}>
            <h2 className="dialog__title" id={titleId}>
                {title}
            </h2>
            <div className="dialog__body">{children}</div>
            {actions && <div className="dialog__actions">{actions}</div>}
        </dialog>
    );
};

export { Dialog, type DialogProps };
