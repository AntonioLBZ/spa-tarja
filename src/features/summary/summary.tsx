import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import { Notice } from '@/components/notice/notice';
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
                <Button glyph aria-label={t('previousMonth')} onClick={() => setMonth(shiftMonth(month, -1))}>
                    ←
                </Button>
                <span className="summary__month-name">{monthName}</span>
                <Button glyph aria-label={t('nextMonth')} onClick={() => setMonth(shiftMonth(month, 1))}>
                    →
                </Button>
            </div>

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
                <Card className="summary__row">
                    <dt>{t('spent')}</dt>
                    <dd className="summary__value">{money(summary.spentCents)}</dd>
                </Card>
                {summary.leftCents !== null && (
                    <Card className="summary__row summary__row--left">
                        <dt>{t('left')}</dt>
                        <dd className={clsx('summary__value', summary.leftCents < 0 && 'summary__value--negative')}>
                            {money(summary.leftCents)}
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

            <IncomeForm month={month} monthName={monthName} income={set} />

            <Link className="summary__link" to="/charts">
                {t('chartsLink')}
            </Link>
        </section>
    );
}

export { Summary };
