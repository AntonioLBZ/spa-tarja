import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { useAnnounce } from '@/components/announcer/announcer';
import { Button } from '@/components/button/button';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { Notice } from '@/components/notice/notice';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useYourExpenses } from '@/features/expenses/data/use-your-expenses';
import { useMoney } from '@/lib/amounts';
import { categoriesQuery } from '@/lib/api';
import { useWeekStart } from '@/lib/i18n';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import {
    GRANULARITIES,
    MAX_BUCKETS,
    bucketCount,
    categoryTotals,
    comparison,
    countedExpenses,
    defaultRange,
    spendingBuckets,
    spendingTotal,
    type Granularity,
    type Range,
} from '@core/charts';
import { toDateString } from '@core/date';

import { CategorySplit } from './category-split';
import { CountedExpenses } from './counted-expenses';
import { SpendingChart } from './spending-chart';
import { SpendingStats } from './spending-stats';

import './charts.css';

type Problem = 'rangeInvalid' | 'rangeTooLong';

const Charts = () => {
    const t = useTranslations('charts');
    const id = useId();
    const { expenses, pendingIds, sourceOf } = useYourExpenses();
    const { options, labelOf, styleOf } = useCategoryOptions();
    const categories = useQuery(categoriesQuery());
    const weekStart = useWeekStart();
    const announce = useAnnounce();
    const money = useMoney();
    const totalRef = useRef<HTMLParagraphElement>(null);

    const [today] = useState(() => toDateString(new Date()));
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [categoryId, setCategoryId] = useState('');
    // Null until the person picks dates: the range then follows the grouping
    const [picked, setPicked] = useState<Range | null>(null);

    const range = useMemo(
        () => picked ?? defaultRange(granularity, today, weekStart),
        [picked, granularity, today, weekStart]
    );
    const problem: Problem | null =
        range.from > range.to
            ? 'rangeInvalid'
            : bucketCount(granularity, range, weekStart) > MAX_BUCKETS
              ? 'rangeTooLong'
              : null;

    // An expense whose category is gone counts under the fallback, as it reads in the list. Until the categories are
    // known any custom one would look gone, so nothing is folded then.
    const known = useMemo(() => new Set(options.map((option) => option.id)), [options]);
    const categoriesKnown = categories.data !== undefined;
    const filed = useMemo(
        () =>
            categoriesKnown
                ? expenses.map((item) =>
                      known.has(item.categoryId) ? item : { ...item, categoryId: FALLBACK_CATEGORY_ID }
                  )
                : expenses,
        [expenses, known, categoriesKnown]
    );
    const filter = known.has(categoryId) ? categoryId : null;

    const buckets = useMemo(
        () => spendingBuckets(filed, { granularity, range, categoryId: filter, weekStart }),
        [filed, granularity, range, filter, weekStart]
    );
    const total = useMemo(() => spendingTotal(filed, { range, categoryId: filter }), [filed, range, filter]);
    // The range, or its days up to today, and the same span of the calendar before it, in the same category
    const compared = useMemo(() => {
        const spans = comparison(range, today);
        if (spans === null) return null;
        return {
            ...spans,
            currentCents: spendingTotal(filed, { range: spans.current, categoryId: filter }),
            previousCents: spendingTotal(filed, { range: spans.previous, categoryId: filter }),
        };
    }, [filed, range, today, filter]);
    const totals = useMemo(() => categoryTotals(filed, range), [filed, range]);
    const counted = useMemo(
        () => countedExpenses(filed, { granularity, range, categoryId: filter, weekStart }),
        [filed, granularity, range, filter, weekStart]
    );

    // Pressing a row of the split changes the numbers above it, out of sight on a phone, so the new total is said
    const pick = (picked: string | null) => {
        setCategoryId(picked ?? '');
        const total = money(spendingTotal(filed, { range, categoryId: picked }));
        announce(picked === null ? t('pickedAll', { total }) : t('picked', { category: labelOf(picked), total }));
    };

    return (
        <section className="charts">
            <ScreenTitle>{t('title')}</ScreenTitle>

            <ChoiceGroup
                legend={t('group.title')}
                name="granularity"
                options={GRANULARITIES.map((value) => ({ value, label: t(`group.${value}`) }))}
                value={granularity}
                onChange={setGranularity}
            />

            <DateRangeFields
                from={range.from}
                to={range.to}
                labels={{ from: t('from'), to: t('to') }}
                invalid={problem !== null}
                describedBy={problem ? `${id}-problem` : undefined}
                onChange={(edge, day) => setPicked({ ...range, [edge]: day })}
            />
            {picked && (
                <Button className="charts__reset" onClick={() => setPicked(null)}>
                    {t('resetRange')}
                </Button>
            )}

            {problem && (
                <Notice tone="danger" role="alert" id={`${id}-problem`}>
                    {t(problem)}
                </Notice>
            )}
            {problem !== 'rangeInvalid' && (
                <SpendingStats
                    totalCents={total}
                    compared={compared}
                    partial={compared !== null && compared.current.to !== range.to}
                    today={today}
                    category={filter === null ? undefined : labelOf(filter)}
                    totalRef={totalRef}
                />
            )}
            {problem === null && (
                <SpendingChart
                    buckets={buckets}
                    granularity={granularity}
                    today={today}
                    category={filter === null ? null : labelOf(filter)}
                />
            )}
            {problem !== 'rangeInvalid' && totals.length === 0 && <Notice tone="quiet">{t('empty')}</Notice>}
            {problem !== 'rangeInvalid' && (totals.length > 0 || filter !== null) && (
                <CategorySplit
                    totals={totals}
                    labelOf={labelOf}
                    styleOf={styleOf}
                    picked={filter}
                    onPick={pick}
                    onEmptied={() => totalRef.current?.focus()}
                />
            )}
            {problem !== 'rangeInvalid' && counted.length > 0 && (
                <CountedExpenses
                    key={`${granularity} ${range.from} ${range.to} ${filter}`}
                    groups={counted}
                    granularity={granularity}
                    pendingIds={pendingIds}
                    sourceOf={sourceOf}
                />
            )}
        </section>
    );
};

export { Charts };
