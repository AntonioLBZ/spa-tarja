import { useMemo } from 'react';

import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';

// Writes a YYYY-MM-DD day the short way in the language of the app, e.g. "Oct 25, 2026"
function useShortDate() {
    const { locale } = useLocale();

    return useMemo(() => {
        const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        return (day: string) => format.format(fromDateString(day));
    }, [locale]);
}

export { useShortDate };
