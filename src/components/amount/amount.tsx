import clsx from 'clsx';

import { Icon } from '@/components/icon/icon';

import './amount.css';

interface AmountProps {
    // The amount as the app writes it, with its symbol and without a sign
    text: string;
    // Which way it goes from the side of whoever its line is about: it adds to their balance or takes from it
    direction?: 'in' | 'out';
    // The cues of that direction, each on its own; none shows without a direction
    color?: boolean;
    sign?: boolean;
    arrow?: boolean;
    className?: string;
}

// Money, with the cues of which way it goes (ADR-0028). The words around it always say it too, so the sign and the
// arrow are hidden from assistive technology
const Amount = (props: AmountProps) => {
    const { text, direction, color, sign, arrow, className } = props;
    const amountClsx = clsx(
        'amount',
        {
            'amount--in': color && direction === 'in',
            'amount--out': color && direction === 'out',
        },
        className
    );

    return (
        <span className={amountClsx}>
            {arrow && direction && (
                <span className="amount__arrow">
                    <Icon name={direction === 'in' ? 'north_east' : 'south_east'} />
                </span>
            )}
            {sign && direction && <span aria-hidden="true">{direction === 'in' ? '+' : '−'}</span>}
            {text}
        </span>
    );
};

export { Amount, type AmountProps };
