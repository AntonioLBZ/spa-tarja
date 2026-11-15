import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Amount } from '@/components/amount/amount';
import { CardList, CardTerm } from '@/components/card/card';
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
            <h1>{t('title')}</h1>

            <MonthSwitch
                monthName={monthName}
                labels={{ previous: tMonthSwitch('previous'), next: tMonthSwitch('next') }}
                onPrevious={() => setMonth(shiftMonth(month, -1))}
                onNext={() => setMonth(shiftMonth(month, 1))}
            />

            <CardList as="dl">
                <CardTerm term={t('income')}>{set ? money(set.amountCents) : t('notSet')}</CardTerm>
                {summary.voucherCents > 0 && <CardTerm term={t('voucher')}>{money(summary.voucherCents)}</CardTerm>}
                {summary.paidBackCents > 0 && <CardTerm term={t('paidBack')}>{money(summary.paidBackCents)}</CardTerm>}
                <CardTerm term={t('spent')}>{money(summary.spentCents)}</CardTerm>
                {summary.leftCents !== null && left && (
                    <CardTerm strong term={t('left')}>
                        <Amount {...left} text={left.sign ? left.text : money(summary.leftCents)} spokenSign />
                    </CardTerm>
                )}
            </CardList>
            {summary.leftCents === null && <p className="hint">{t('leftHint')}</p>}

            {income.isError && income.data === undefined && (
                <p className="hint" role="alert">
                    {t('loadFailed')}
                </p>
            )}
            {!online && <Notice role="status">{t('offline')}</Notice>}

            <BudgetBars month={month} />

            <IncomeForm month={month} monthName={monthName} income={set} />

            <Actions>
                <Link className="summary__link" to="/budgets">
                    {t('budgetsLink')}
                </Link>
                <Link className="summary__link" to="/charts">
                    {t('chartsLink')}
                </Link>
            </Actions>
        </section>
    );
};

export { Summary };
