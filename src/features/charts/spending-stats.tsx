import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Card } from '@/components/card/card';
import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { Granularity, Range } from '@core/charts';

import './spending-stats.css';

interface SpendingStatsProps {
    totalCents: number;
    // What the same category took in the previous period, and its days
    previousCents: number;
    previous: Range;
    granularity: Granularity;
    today: string;
}

// The total of the range and how it changed against the previous period: an arrow and a signed share, never a color
function SpendingStats(props: SpendingStatsProps) {
    const { totalCents, previousCents, previous, granularity, today } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();

    // A period of months reads as months; days and weeks as days, with the year when it isn't this one
    const year = previous.from.slice(0, 4) !== previous.to.slice(0, 4) || previous.to.slice(0, 4) !== today.slice(0, 4);
    const periodFormat = useMemo(
        () =>
            new Intl.DateTimeFormat(
                locale,
                granularity === 'month'
                    ? { month: 'short', year: 'numeric' }
                    : { month: 'short', day: 'numeric', ...(year && { year: 'numeric' }) }
            ),
        [locale, granularity, year]
    );
    const percent = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }),
        [locale]
    );

    const period = periodFormat.formatRange(fromDateString(previous.from), fromDateString(previous.to));
    // In whole percents, so the arrow agrees with the number shown
    const change = previousCents === 0 ? null : Math.round(((totalCents - previousCents) / previousCents) * 100);
    const arrow = change === null || change === 0 ? null : change > 0 ? '↑' : '↓';

    return (
        <Card className="spending-stats">
            <p className="spending-stats__total">
                <span>{t('total')}</span>
                <strong>{formatAmount(totalCents, DEFAULT_CURRENCY, locale)}</strong>
            </p>
            <p className="spending-stats__change">
                {arrow && (
                    <span className="spending-stats__arrow" aria-hidden="true">
                        {arrow}
                    </span>
                )}
                {change === null
                    ? t('noPrevious', { period })
                    : t('vsPrevious', { change: percent.format(change / 100), period })}
            </p>
        </Card>
    );
}

export { SpendingStats };
