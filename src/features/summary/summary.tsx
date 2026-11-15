import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Amount } from '@/components/amount/amount';
import { Card, CardList } from '@/components/card/card';
import { MonthSwitch } from '@/components/month-switch/month-switch';
import { Notice } from '@/components/notice/notice';
import { BudgetBars } from '@/features/budgets/budget-bars';
import { useYourExpenses } from '@/features/expenses/use-your-expenses';
import { useAmount, useMoney } from '@/lib/amounts';
import { incomeQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { fromDateString, toDateString } from '@core/date';
import { monthOf, shiftMonth } from '@core/month';
import { summarizeMonth } from '@core/summary';

import { IncomeForm } from './income-form';

import './summary.css';

const Summary = () => {
    const t = useTranslations('summary');
    const tMonthSwitch = useTranslations('monthSwitch');
    const { locale } = useLocale();
    const online = useOnline();
    const { expenses } = useYourExpenses();
    const income = useQuery(incomeQuery());
    const [month, setMonth] = useState(() => monthOf(toDateString(new Date())));

    const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
    const monthName = monthFormat.format(fromDateString(`${month}-01`));
    const set = income.data?.find((item) => item.month === month);
    const summary = summarizeMonth(month, expenses, set?.amountCents ?? null);
    const money = useMoney();
    const amount = useAmount();
    // What is left takes color and sign as the person allows (ADR-0028); without the sign, below zero keeps its minus
    const left = summary.leftCents === null ? null : amount(summary.leftCents, undefined, { cues: true });

    return (
        <section className="summary">
            <h1 className="summary__title">{t('title')}</h1>

            <MonthSwitch
                monthName={monthName}
                labels={{ previous: tMonthSwitch('previous'), next: tMonthSwitch('next') }}
                onPrevious={() => setMonth(shiftMonth(month, -1))}
                onNext={() => setMonth(shiftMonth(month, 1))}
            />

            <CardList as="dl">
                <Card className="summary__row">
                    <dt>{t('income')}</dt>
                    <dd className="summary__value">{set ? money(set.amountCents) : t('notSet')}</dd>
                </Card>
                {summary.voucherCents > 0 && (
                    <Card className="summary__row">
                        <dt>{t('voucher')}</dt>
                        <dd className="summary__value">{money(summary.voucherCents)}</dd>
                    </Card>
                )}
                {summary.paidBackCents > 0 && (
                    <Card className="summary__row">
                        <dt>{t('paidBack')}</dt>
                        <dd className="summary__value">{money(summary.paidBackCents)}</dd>
                    </Card>
                )}
                <Card className="summary__row">
                    <dt>{t('spent')}</dt>
                    <dd className="summary__value">{money(summary.spentCents)}</dd>
                </Card>
                {summary.leftCents !== null && left && (
                    <Card className="summary__row summary__row--left">
                        <dt>{t('left')}</dt>
                        <dd className="summary__value">
                            <Amount {...left} text={left.sign ? left.text : money(summary.leftCents)} spokenSign />
                        </dd>
                    </Card>
                )}
            </CardList>
            {summary.leftCents === null && <p className="summary__hint">{t('leftHint')}</p>}

            {income.isError && income.data === undefined && (
                <p className="summary__hint" role="alert">
                    {t('loadFailed')}
                </p>
            )}
            {!online && <Notice role="status">{t('offline')}</Notice>}

            <BudgetBars month={month} />

            <IncomeForm month={month} monthName={monthName} income={set} />

            <div className="summary__links">
                <Link className="summary__link" to="/budgets">
                    {t('budgetsLink')}
                </Link>
                <Link className="summary__link" to="/charts">
                    {t('chartsLink')}
                </Link>
            </div>
        </section>
    );
};

export { Summary };
