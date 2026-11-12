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
    // So that something else on the screen can scroll to this sheet
    id?: string;
    // Lets the screen put the focus on the label when what had it is gone, as a row that was removed
    labelRef?: Ref<HTMLHeadingElement>;
    children: ReactNode;
}

// A sheet of paper, like a receipt: a label and what is written on it
const Sheet = (props: SheetProps) => {
    const { label, level: Heading = 'h2', className, labelClassName, labelRef, id, children } = props;
    const sheetClsx = clsx('sheet', className);
    const labelClsx = clsx('sheet__label', labelClassName);

    return (
        <section className={sheetClsx} id={id}>
            {label ? (
                <Heading ref={labelRef} className={labelClsx} tabIndex={labelRef ? -1 : undefined}>
                    {label}
                </Heading>
            ) : null}
            {children}
        </section>
    );
};

export { Sheet, type SheetProps };
