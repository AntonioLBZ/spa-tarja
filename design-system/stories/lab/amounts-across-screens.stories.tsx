import { Amount } from '@/components/amount/amount';
import { Card, CardList } from '@/components/card/card';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { useAmount, useMoney } from '@/lib/amounts';

import type { Meta } from '@storybook/react-vite';
import type { ReactNode } from 'react';

import './amounts-lab.css';

// Where else color and sign could show (ADR-0028): each story is a screen, today and the options, for the owner to
// choose. The words are the app's; the numbers are made up

interface OptionProps {
    caption: string;
    children: ReactNode;
}

const Option = (props: OptionProps) => {
    const { caption, children } = props;
    return (
        <section className="amounts-lab__option">
            <p className="amounts-lab__caption">{caption}</p>
            {children}
        </section>
    );
};

interface RowProps {
    words: ReactNode;
    cents: number;
    // Which cues the screen would ask for: none, color alone (inside a sentence) or color and sign (in a column)
    cues?: 'none' | 'color' | 'both';
    total?: boolean;
}

const Row = (props: RowProps) => {
    const { words, cents, cues = 'none', total } = props;
    const amount = useAmount()(cents, undefined, { cues: cues !== 'none' });

    return (
        <li className={total ? 'amounts-lab__row amounts-lab__row--total' : 'amounts-lab__row'}>
            <span className="amounts-lab__words">{words}</span>
            <Amount {...amount} sign={cues === 'both' && amount.sign} />
        </li>
    );
};

const EXPENSES: [string, number][] = [
    ['Coffee', -320],
    ['Groceries', -4215],
    ['Bus', -170],
];

const Day = (props: { cues: RowProps['cues'] }) => (
    <Sheet label="Saturday, 14 November">
        <ul className="amounts-lab__list">
            {EXPENSES.map(([words, cents]) => (
                <Row key={words} words={words} cents={cents} cues={props.cues} />
            ))}
            <Row total words="Total" cents={-4705} cues={props.cues} />
        </ul>
    </Sheet>
);

export const ExpenseList = () => (
    <div className="amounts-lab">
        <Option caption="Today, and the proposal: nothing changes. Every row is money going out, so a cue says nothing">
            <Day cues="none" />
        </Option>
        <Option caption="Not proposed: color and sign on every expense, a list all in red">
            <Day cues="both" />
        </Option>
    </div>
);
ExpenseList.storyName = 'Expense list and its subtotals';

const SummaryRows = (props: { left: number; cues: 'today' | 'left' | 'all' }) => {
    const { left, cues } = props;
    const money = useMoney();
    const each = cues === 'all' ? 'both' : 'none';
    return (
        <CardList>
            {[
                ['Income', 150000],
                ['Spent', -123000],
            ].map(([words, cents]) => (
                <Card key={words}>
                    <ul className="amounts-lab__list">
                        <Row words={words} cents={cents as number} cues={each} />
                    </ul>
                </Card>
            ))}
            <Card>
                <ul className="amounts-lab__list">
                    {cues === 'today' ? (
                        <li className="amounts-lab__row amounts-lab__row--total">
                            <span className="amounts-lab__words">Left</span>
                            <Amount text={money(left)} className={left < 0 ? 'amounts-lab__danger' : undefined} />
                        </li>
                    ) : (
                        <Row total words="Left" cents={left} cues="both" />
                    )}
                </ul>
            </Card>
        </CardList>
    );
};

export const Summary = () => (
    <div className="amounts-lab">
        <Option caption="Today: Left in the danger color only when it is below zero">
            <SummaryRows left={-3500} cues="today" />
        </Option>
        <Option caption="Proposal: Left alone gets color and sign, + when money is left, − when over">
            <SummaryRows left={27000} cues="left" />
            <SummaryRows left={-3500} cues="left" />
        </Option>
        <Option caption="Alternative: income, spent and left, each with its cues">
            <SummaryRows left={27000} cues="all" />
        </Option>
    </div>
);
Summary.storyName = 'Summary of the month';

const GroupsTotals = (props: { cues: boolean }) => {
    const amount = useAmount();
    const owed = amount(3500, undefined, { cues: props.cues });
    const owe = amount(-1250, undefined, { cues: props.cues });
    return (
        <>
            <Notice role="status">
                You are owed <Amount {...owed} sign={false} />
            </Notice>
            <Notice role="status">
                You owe <Amount {...owe} sign={false} />
            </Notice>
            <CardList>
                <Card>
                    <strong>Lisbon</strong>
                    <br />
                    <span className="amounts-lab__secondary">
                        You are owed <Amount {...amount(2000, undefined, { cues: props.cues })} sign={false} />
                    </span>
                </Card>
                <Card>
                    <strong>Bruno</strong>
                    <br />
                    <span className="amounts-lab__secondary">
                        You owe <Amount {...amount(-1250, undefined, { cues: props.cues })} sign={false} />
                    </span>
                </Card>
            </CardList>
        </>
    );
};

export const Groups = () => (
    <div className="amounts-lab">
        <Option caption="Today">
            <GroupsTotals cues={false} />
        </Option>
        <Option caption="Proposal: color on the amount of each sentence, the totals and each group's row; no sign, since the sentence already says which way">
            <GroupsTotals cues />
        </Option>
    </div>
);
Groups.storyName = 'Groups: the totals and each row';

const BalanceInWords = (props: { cues: boolean }) => {
    const amount = useAmount();
    return (
        <Notice role="status">
            You are owed <Amount {...amount(4150, undefined, { cues: props.cues })} sign={false} />
        </Notice>
    );
};

export const GroupNotice = () => (
    <div className="amounts-lab">
        <Option caption="Today">
            <BalanceInWords cues={false} />
        </Option>
        <Option caption="Proposal: color on the amount, as in the rows under it">
            <BalanceInWords cues />
        </Option>
    </div>
);
GroupNotice.storyName = 'Group screen: the balance in words';

const Ledger = (props: { effect: boolean }) => (
    <Sheet>
        <ul className="amounts-lab__list">
            <Row
                words="Dinner · you paid, your part €30.00"
                cents={props.effect ? 6000 : -9000}
                cues={props.effect ? 'both' : 'none'}
            />
            <Row words="Museum · Bruno paid, your part €12.50" cents={-1250} cues={props.effect ? 'both' : 'none'} />
            <Row words="You paid Bruno" cents={props.effect ? 1100 : -1100} cues={props.effect ? 'both' : 'none'} />
        </ul>
    </Sheet>
);

export const GroupLedger = () => (
    <div className="amounts-lab">
        <Option caption="Today, and the proposal: the amount of each entry, no cue (an expense is not yours alone)">
            <Ledger effect={false} />
        </Option>
        <Option caption="Alternative: show what each entry did to your balance, with its cues (+€60.00: you lent it; −€12.50: your part)">
            <Ledger effect />
        </Option>
    </div>
);
GroupLedger.storyName = 'Group screen: the ledger';

const Budget = (props: { cues: boolean }) => (
    <CardList>
        <Card>
            <ul className="amounts-lab__list">
                <Row words="Food · left" cents={4500} cues={props.cues ? 'both' : 'none'} />
                <Row words="Leisure · over" cents={-1200} cues={props.cues ? 'both' : 'none'} />
            </ul>
        </Card>
    </CardList>
);

export const Budgets = () => (
    <div className="amounts-lab">
        <Option caption="Today, and the proposal: the bar and the danger color for a crossed limit already say it">
            <Budget cues={false} />
        </Option>
        <Option caption="Alternative: what is left and what is over, with their cues">
            <Budget cues />
        </Option>
    </div>
);
Budgets.storyName = 'Budgets';

const Story: Meta = {
    title: 'Lab/AmountsAcrossScreens',
    globals: { viewport: { value: 'phone' } },
};

export default Story;
