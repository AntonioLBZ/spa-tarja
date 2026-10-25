import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { useExpenses } from '@/features/expenses/use-expenses';
import { incomeQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { fromDateString, toDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';
import { monthOf, shiftMonth } from '@core/month';
import { summarizeMonth } from '@core/summary';

import { IncomeForm } from './income-form';

import './summary.css';

function Summary() {
    const t = useTranslations('summary');
    const { locale } = useLocale();
    const online = useOnline();
    const { expenses } = useExpenses();
    const income = useQuery(incomeQuery());
    const [month, setMonth] = useState(() => monthOf(toDateString(new Date())));

    const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
    const monthName = monthFormat.format(fromDateString(`${month}-01`));
    const set = income.data?.find((item) => item.month === month);
    const summary = summarizeMonth(month, expenses, set?.amountCents ?? null);
    const money = (cents: number) => formatAmount(cents, DEFAULT_CURRENCY, locale);

    return (
        <section className="summary">
            <h1 className="summary__title">{t('title')}</h1>

            <div className="summary__month">
                <button aria-label={t('previousMonth')} type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
                    ←
                </button>
                <span className="summary__month-name">{monthName}</span>
                <button aria-label={t('nextMonth')} type="button" onClick={() => setMonth(shiftMonth(month, 1))}>
                    →
                </button>
            </div>

            <dl className="summary__rows">
                <div className="summary__row">
                    <dt>{t('income')}</dt>
                    <dd className="summary__value">{set ? money(set.amountCents) : t('notSet')}</dd>
                </div>
                {summary.voucherCents > 0 && (
                    <div className="summary__row">
                        <dt>{t('voucher')}</dt>
                        <dd className="summary__value">{money(summary.voucherCents)}</dd>
                    </div>
                )}
                <div className="summary__row">
                    <dt>{t('spent')}</dt>
                    <dd className="summary__value">{money(summary.spentCents)}</dd>
                </div>
                {summary.leftCents !== null && (
                    <div className="summary__row summary__row--left">
                        <dt>{t('left')}</dt>
                        <dd className={clsx('summary__value', summary.leftCents < 0 && 'summary__value--negative')}>
                            {money(summary.leftCents)}
                        </dd>
                    </div>
                )}
            </dl>
            {summary.leftCents === null && <p className="summary__hint">{t('leftHint')}</p>}

            {income.isError && income.data === undefined && (
                <p className="summary__hint" role="alert">
                    {t('loadFailed')}
                </p>
            )}
            {!online && (
                <p className="summary__notice" role="status">
                    {t('offline')}
                </p>
            )}

            <IncomeForm month={month} monthName={monthName} income={set} />
        </section>
    );
}

export { Summary };
