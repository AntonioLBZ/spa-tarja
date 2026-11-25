import { useMemo } from 'react';

import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/basics/date';

// One per locale for every row of a list, since making a format costs far more than using it
const formats = new Map<string, Intl.DateTimeFormat>();

const shortFormatOf = (locale: string): Intl.DateTimeFormat => {
    let format = formats.get(locale);
    if (format === undefined) {
        format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        formats.set(locale, format);
    }
    return format;
};

// Writes a YYYY-MM-DD day the short way in the language of the app, e.g. "Oct 25, 2026"
const useShortDate = () => {
    const { locale } = useLocale();

    return useMemo(() => {
        const format = shortFormatOf(locale);
        return (day: string) => format.format(fromDateString(day));
    }, [locale]);
};

export { useShortDate };
