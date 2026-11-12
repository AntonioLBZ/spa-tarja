import clsx from 'clsx';

import type { ReactNode, Ref } from 'react';

import './sheet.css';

interface SheetProps {
    // The heading of the group; a sheet without one has none
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

// A group of rows under a heading that stays at the top of the screen while they scroll by
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
