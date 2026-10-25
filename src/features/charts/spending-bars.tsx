import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Bar } from '@/components/bar/bar';
import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { Bucket, Granularity } from '@core/charts';

import './spending-bars.css';

const FORMATS: Record<Granularity, Intl.DateTimeFormatOptions> = {
    day: { weekday: 'short', month: 'short', day: 'numeric' },
    week: { month: 'short', day: 'numeric' },
    month: { month: 'long', year: 'numeric' },
};

// One row for each bucket: what it is, how much, and a bar next to the biggest of them
function SpendingBars(props: { buckets: readonly Bucket[]; granularity: Granularity }) {
    const { buckets, granularity } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();

    // Without the year two rows of different years would read the same
    const overYears = buckets.length > 0 && buckets[0]!.start.slice(0, 4) !== buckets.at(-1)!.start.slice(0, 4);
    const format = useMemo(
        () =>
            new Intl.DateTimeFormat(
                locale,
                overYears ? { ...FORMATS[granularity], year: 'numeric' } : FORMATS[granularity]
            ),
        [locale, granularity, overYears]
    );
    const nameOf = (start: string) => {
        const date = format.format(fromDateString(start));
        return granularity === 'week' ? t('weekOf', { date }) : date;
    };
    const biggest = buckets.reduce((most, bucket) => Math.max(most, bucket.totalCents), 0);

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
