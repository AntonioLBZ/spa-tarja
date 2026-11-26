import clsx from 'clsx';

import { Icon } from '@/components/icon/icon';

import './amount.css';

interface AmountProps {
    /** The amount as the app writes it, with its symbol and without a sign */
    text: string;
    /** Which way it goes from the side of whoever its line is about: it adds to their balance or takes from it */
    direction?: 'in' | 'out';
    /** Paints it in the amount colors; nothing without a direction */
    color?: boolean;
    /** Puts + or − before it, hidden from assistive technology; nothing without a direction */
    sign?: boolean;
    /** Puts an arrow up or down before it; nothing without a direction */
    arrow?: boolean;
    /** Reads the sign aloud, where no words around the amount say which way it goes */
    spokenSign?: boolean;
    className?: string;
}

// Money, with the cues of which way it goes (ADR-0028). The words around it usually say it too, so the sign and the
// arrow are hidden from assistive technology unless `spokenSign` says otherwise
const Amount = (props: AmountProps) => {
    const { text, direction, color, sign, arrow, spokenSign, className } = props;
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
            {sign && direction && (
                <span aria-hidden={spokenSign ? undefined : 'true'}>{direction === 'in' ? '+' : '−'}</span>
            )}
            {text}
        </span>
    );
};

export { Amount, type AmountProps };
