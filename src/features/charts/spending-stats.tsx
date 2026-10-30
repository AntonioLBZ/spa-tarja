import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Card } from '@/components/card/card';
import { useLocale } from '@/lib/i18n';
import { endOfMonth, fromDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { Range } from '@core/charts';

import './spending-stats.css';

// Two spans as long as each other and what the same category took in each
interface ComparedTotals {
    current: Range;
    previous: Range;
    currentCents: number;
    previousCents: number;
}

interface SpendingStatsProps {
    // The total of the whole range
    totalCents: number;
    // Null when there is nothing to compare, for a range that starts after today
    compared: ComparedTotals | null;
    // Whether the current span is only part of the range, the days up to today
    partial: boolean;
    today: string;
}

const MONTHS: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
const DAYS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const DAYS_WITH_YEAR: Intl.DateTimeFormatOptions = { ...DAYS, year: 'numeric' };

// The total of the range and how it changed against an earlier span of the same length: an arrow and a signed share,
// never a color
const SpendingStats = (props: SpendingStatsProps) => {
    const { totalCents, compared, partial, today } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();

    const formats = useMemo(
        () => ({
            months: new Intl.DateTimeFormat(locale, MONTHS),
            days: new Intl.DateTimeFormat(locale, DAYS),
            daysWithYear: new Intl.DateTimeFormat(locale, DAYS_WITH_YEAR),
            percent: new Intl.NumberFormat(locale, {
                style: 'percent',
                maximumFractionDigits: 0,
                signDisplay: 'exceptZero',
            }),
        }),
        [locale]
    );

    // Whole months read as months; any other span as days, with the year when it isn't this one
    const spanName = (span: Range) => {
        const wholeMonths = span.from.endsWith('-01') && span.to === endOfMonth(span.to);
        const year = span.from.slice(0, 4) !== span.to.slice(0, 4) || span.to.slice(0, 4) !== today.slice(0, 4);
        const format = wholeMonths ? formats.months : year ? formats.daysWithYear : formats.days;
        return format.formatRange(fromDateString(span.from), fromDateString(span.to));
    };

    const changeLine = (totals: ComparedTotals) => {
        const period = spanName(totals.previous);
        const current = spanName(totals.current);
        if (totals.previousCents === 0) {
            return {
                arrow: null,
                text: partial ? t('noPreviousSoFar', { current, period }) : t('noPrevious', { period }),
            };
        }
        // In whole percents, so the arrow agrees with the number shown
        const change = Math.round(((totals.currentCents - totals.previousCents) / totals.previousCents) * 100);
        const values = { change: formats.percent.format(change / 100), current, period };
        return {
            arrow: change > 0 ? '↑' : change < 0 ? '↓' : null,
            text: partial ? t('vsPreviousSoFar', values) : t('vsPrevious', values),
        };
    };

    const line = compared && changeLine(compared);

    return (
        <Card className="spending-stats">
            <p className="spending-stats__total">
                <span>{t('total')}</span>
                <strong>{formatAmount(totalCents, DEFAULT_CURRENCY, locale)}</strong>
            </p>
            {line && (
                <p className="spending-stats__change">
                    {line.arrow && (
                        <span className="spending-stats__arrow" aria-hidden="true">
                            {line.arrow}
                        </span>
                    )}
                    {line.text}
                </p>
            )}
        </Card>
    );
};

export { SpendingStats, type SpendingStatsProps };
