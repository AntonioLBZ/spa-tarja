import { Amount, type AmountProps } from '@/components/amount/amount';

interface SentenceWithAmountProps {
    // The sentence as the locale writes it, with the amount given
    sentence: (amount: string) => string;
    amount: AmountProps;
}

// Where the amount falls in a sentence of the locale
const MARK = '\u0000';

// A sentence with its amount drawn as an `Amount`, so that it can take its color. Assistive technology reads the
// sentence whole, as it was written
const SentenceWithAmount = (props: SentenceWithAmountProps) => {
    const { sentence, amount } = props;
    const marked = sentence(MARK);
    if (!marked.includes(MARK)) return marked;
    const [before = '', after = ''] = marked.split(MARK);

    return (
        <>
            <span className="visually-hidden">{sentence(amount.text)}</span>
            <span aria-hidden="true">
                {before}
                <Amount {...amount} sign={false} />
                {after}
            </span>
        </>
    );
};

export { SentenceWithAmount, type SentenceWithAmountProps };
