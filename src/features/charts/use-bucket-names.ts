import { useCallback, useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';

import type { Bucket, Granularity } from '@core/charts';

const NAMES: Record<Granularity, Intl.DateTimeFormatOptions> = {
    day: { weekday: 'short', month: 'short', day: 'numeric' },
    week: { month: 'short', day: 'numeric' },
    month: { month: 'long', year: 'numeric' },
};

// What the axis says under the first and the last column, where there is room for little
const SHORT_NAMES: Record<Granularity, Intl.DateTimeFormatOptions> = {
    day: { month: 'short', day: 'numeric' },
    week: { month: 'short', day: 'numeric' },
    month: { month: 'short', year: 'numeric' },
};

// The names of the rows of a chart: in full for the table, the readout and the summary, and short for the axis. Without
// the year two rows of different years would read the same, so it is added when the rows go over a New Year.
function useBucketNames(buckets: readonly Bucket[], granularity: Granularity) {
    const t = useTranslations('charts');
    const { locale } = useLocale();

    const overYears = buckets.length > 0 && buckets[0]!.start.slice(0, 4) !== buckets.at(-1)!.start.slice(0, 4);
    const [full, short] = useMemo(() => {
        const year: Intl.DateTimeFormatOptions = overYears ? { year: 'numeric' } : {};
        return [
            new Intl.DateTimeFormat(locale, { ...NAMES[granularity], ...year }),
            new Intl.DateTimeFormat(locale, { ...SHORT_NAMES[granularity], ...year }),
        ];
    }, [locale, granularity, overYears]);

    const nameOf = useCallback(
        (start: string) => {
            const date = full.format(fromDateString(start));
            return granularity === 'week' ? t('weekOf', { date }) : date;
        },
        [full, granularity, t]
    );
    const shortNameOf = useCallback((start: string) => short.format(fromDateString(start)), [short]);

    return { nameOf, shortNameOf };
}

export { useBucketNames };
