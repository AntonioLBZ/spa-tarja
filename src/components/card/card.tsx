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
const Card = (props: CardProps) => {
    const { as: Tag = 'div', className, children } = props;
    const cardClsx = clsx('card', className);

    return <Tag className={cardClsx}>{children}</Tag>;
};

// Cards stacked one under another, `--size-2` apart
const CardList = (props: CardListProps) => {
    const { as: Tag = 'ul', flush, label, className, children } = props;
    const cardListClsx = clsx('card-list', { 'card-list--flush': flush }, className);

    return (
        <Tag aria-label={label} className={cardListClsx}>
            {children}
        </Tag>
    );
};

export { Card, CardList, type CardListProps, type CardProps };
