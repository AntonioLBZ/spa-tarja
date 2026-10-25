import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Bar } from '@/components/bar/bar';
import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { Bucket, Granularity } from '@core/charts';

import './spending-bars.css';

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
const WEEK_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

const FORMATS: Record<Granularity, Intl.DateTimeFormatOptions> = {
    day: DAY_FORMAT,
    week: WEEK_FORMAT,
    month: MONTH_FORMAT,
};

// One row for each bucket: what it is, how much, and a bar next to the biggest of them
function SpendingBars(props: { buckets: readonly Bucket[]; granularity: Granularity }) {
    const { buckets, granularity } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();

    const format = useMemo(() => new Intl.DateTimeFormat(locale, FORMATS[granularity]), [locale, granularity]);
    const nameOf = (start: string) => {
        const date = format.format(fromDateString(start));
        return granularity === 'week' ? t('weekOf', { date }) : date;
    };
    const biggest = Math.max(0, ...buckets.map((bucket) => bucket.totalCents));

    return (
        <ol className="spending-bars" aria-label={t('spendingTitle')}>
            {buckets.map((bucket) => (
                <li className="spending-bars__row" key={bucket.start}>
                    <span className="spending-bars__name">{nameOf(bucket.start)}</span>
                    <span className="spending-bars__amount">
                        {formatAmount(bucket.totalCents, DEFAULT_CURRENCY, locale)}
                    </span>
                    <Bar share={biggest === 0 ? 0 : bucket.totalCents / biggest} />
                </li>
            ))}
        </ol>
    );
}

export { SpendingBars };
