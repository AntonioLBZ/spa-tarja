import clsx from 'clsx';

import type { ReactNode } from 'react';

import './card.css';

interface CardProps {
    as?: 'div' | 'li';
    // Its one link covers the whole card, and the ring of the link goes round the card
    linked?: boolean;
    className?: string;
    children: ReactNode;
}

interface CardTermProps {
    // What the value is
    term: ReactNode;
    // In ink and bold, for the row that sums up the others
    strong?: boolean;
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

// A row drawn as its bottom edge alone, with the padding of a row above and below. What goes inside it, and how, is
// up to the call site.
const Card = (props: CardProps) => {
    const { as: Tag = 'div', linked, className, children } = props;
    const cardClsx = clsx('card', { 'card--linked': linked }, className);

    return <Tag className={cardClsx}>{children}</Tag>;
};

// A card that names a value, in a `CardList` that is a description list: the term at the start, the value at the end
const CardTerm = (props: CardTermProps) => {
    const { term, strong, className, children } = props;
    const termClsx = clsx('card', 'card-term', { 'card-term--strong': strong }, className);

    return (
        <div className={termClsx}>
            <dt className="card-term__term">{term}</dt>
            <dd className="card-term__value">{children}</dd>
        </div>
    );
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

export { Card, CardList, CardTerm, type CardListProps, type CardProps, type CardTermProps };
