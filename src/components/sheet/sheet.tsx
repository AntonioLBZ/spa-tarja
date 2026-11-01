import clsx from 'clsx';

import type { ReactNode } from 'react';

import './sheet.css';

interface SheetProps {
    // Centered in capitals over a dashed rule
    label: ReactNode;
    // The heading that holds the label
    level?: 'h2' | 'h3';
    className?: string;
    labelClassName?: string;
    children: ReactNode;
}

// A sheet of paper, like a receipt: a label and what is written on it
const Sheet = (props: SheetProps) => {
    const { label, level: Heading = 'h2', className, labelClassName, children } = props;
    const sheetClsx = clsx('sheet', className);
    const labelClsx = clsx('sheet__label', labelClassName);

    return (
        <section className={sheetClsx}>
            <Heading className={labelClsx}>{label}</Heading>
            {children}
        </section>
    );
};

export { Sheet, type SheetProps };
