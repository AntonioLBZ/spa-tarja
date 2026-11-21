import { useState } from 'react';

import { MONDAY, type WeekDay } from '@core/date';

interface WeekInfo {
    firstDay: number;
}

// The week info of a locale: a method in current browsers, a getter in older ones, missing in some
type LocaleWithWeekInfo = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };

const isWeekDay = (value: unknown): value is WeekDay =>
    Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;

// The first day of the week of the first language that names a locale, Monday when the browser can't tell (ADR-0039)
const weekStartOf = (languages: readonly string[]): WeekDay => {
    for (const language of languages) {
        let locale: LocaleWithWeekInfo;
        try {
            locale = new Intl.Locale(language);
        } catch {
            continue;
        }
        const info = typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo;
        return isWeekDay(info?.firstDay) ? info.firstDay : MONDAY;
    }
    return MONDAY;
};

// Read once, when the screen mounts
const useWeekStart = (): WeekDay => {
    const [weekStart] = useState(() => weekStartOf(navigator.languages));
    return weekStart;
};

export { useWeekStart, weekStartOf };
