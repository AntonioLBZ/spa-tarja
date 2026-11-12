import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { useBudgets } from '@/features/budgets/use-budgets';
import { HeroStat } from '@/features/shell/hero-stat';
import { incomeQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { TOTAL_SCOPE, budgetUses } from '@core/budget';
import { fromDateString, toDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';
import { monthOf } from '@core/month';
import { spentByDay } from '@core/month-days';
import { summarizeMonth } from '@core/summary';

import { MonthComb } from './month-comb';
import { useYourExpenses } from './use-your-expenses';

// The answer of the home: what this month has cost so far, what is left of it, and the month as a comb of days. Tapping
// a day takes the list to it.
const MonthHero = () => {
    const t = useTranslations('home.hero');
    const { locale } = useLocale();
    const { expenses } = useYourExpenses();
    const income = useQuery(incomeQuery());
    const { budgets, scopes, categoryOf } = useBudgets();
    const [scrubbed, setScrubbed] = useState<number | null>(null);

    const todayDay = toDateString(new Date());
    const month = monthOf(todayDay);
    const first = fromDateString(`${month}-01`);
    const money = (cents: number) => formatAmount(cents, DEFAULT_CURRENCY, locale);

    const set = income.data?.find((item) => item.month === month);
    const summary = summarizeMonth(month, expenses, set?.amountCents ?? null);
    const days = spentByDay(month, expenses);
    const limit = budgetUses({ month, expenses, budgets, scopes, categoryOf }).find((use) => use.scope === TOTAL_SCOPE);

    const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(first);
    const dayName = (day: number) => {
        const date = fromDateString(`${month}-${String(day).padStart(2, '0')}`);
        return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    };

    const sub = () => {
        if (scrubbed !== null) {
            return t('day', { day: dayName(scrubbed), amount: money(days[scrubbed - 1] ?? 0) });
        }
        if (limit) {
            return limit.state === 'over'
                ? t('overLimit', { over: money(limit.spentCents - limit.limitCents), limit: money(limit.limitCents) })
                : t('ofLimit', { limit: money(limit.limitCents), left: money(limit.limitCents - limit.spentCents) });
        }
        if (summary.leftCents !== null && set) {
            return summary.leftCents < 0
                ? t('overIncome', { over: money(-summary.leftCents) })
                : t('ofIncome', { left: money(summary.leftCents), income: money(set.amountCents) });
        }
        return null;
    };

    const line = sub();
    const pickDay = (day: number) => {
        const key = `${month}-${String(day).padStart(2, '0')}`;
        document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <HeroStat
            label={t('label', { month: monthName })}
            amount={{ value: summary.spentCents, format: money }}
            sub={line ?? <Link to="/summary">{t('setIncome')}</Link>}
            subLive
        >
            <MonthComb
                days={days}
                today={days.length > 0 ? Number(todayDay.slice(8, 10)) : 0}
                firstWeekday={first.getDay()}
                onScrub={setScrubbed}
                onPick={pickDay}
            />
        </HeroStat>
    );
};

export { MonthHero };
