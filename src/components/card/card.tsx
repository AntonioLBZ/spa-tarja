import clsx from 'clsx';

import type { ReactNode } from 'react';

import './card.css';

interface CardProps {
    as?: 'div' | 'li';
    className?: string;
    children: ReactNode;
}

interface CardListProps {
    as?: 'ul' | 'ol' | 'dl';
    // Cards that touch, for a list whose rows are far enough apart by themselves
    flush?: boolean;
    // The name of a list with no heading of its own, for assistive technology
    label?: string;
    className?: string;
    children: ReactNode;
}

// A box with the notch and the padding of a row. What goes inside it, and how, is up to the call site.
function Card(props: CardProps) {
    const { as: Tag = 'div', className, children } = props;

    return <Tag className={clsx('card', className)}>{children}</Tag>;
}

// Cards stacked one under another, `--size-2` apart
function CardList(props: CardListProps) {
    const { as: Tag = 'ul', flush, label, className, children } = props;

    return (
        <Tag aria-label={label} className={clsx('card-list', flush && 'card-list--flush', className)}>
            {children}
        </Tag>
    );
}

export { Card, CardList };
export type { CardListProps, CardProps };
