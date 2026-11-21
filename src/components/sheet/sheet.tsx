import clsx from 'clsx';

import type { ReactNode, Ref } from 'react';

import './sheet.css';

interface SheetProps {
    // Centered in capitals over a dashed rule; a sheet without one has no heading
    label?: ReactNode;
    // The heading that holds the label
    level?: 'h2' | 'h3';
    className?: string;
    labelClassName?: string;
    // Lets the screen put the focus on the label when what had it is gone, as a row that was removed
    labelRef?: Ref<HTMLHeadingElement>;
    // A small ghost button at the end of the row of the label, which stays centered
    action?: ReactNode;
    children: ReactNode;
}

// A sheet of paper, like a receipt: a label and what is written on it
const Sheet = (props: SheetProps) => {
    const { label, level: Heading = 'h2', className, labelClassName, labelRef, action, children } = props;
    const sheetClsx = clsx('sheet', className);
    const labelClsx = clsx('sheet__label', labelClassName);
    const heading = label ? (
        <Heading ref={labelRef} className={labelClsx} tabIndex={labelRef ? -1 : undefined}>
            {label}
        </Heading>
    ) : null;

    return (
        <section className={sheetClsx}>
            {action ? (
                <div className="sheet__head">
                    {heading}
                    <div className="sheet__action">{action}</div>
                </div>
            ) : (
                heading
            )}
            {children}
        </section>
    );
};

export { Sheet, type SheetProps };
