import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { Notice } from '@/components/notice/notice';
import { CategorySelect } from '@/features/categories/category-select';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { categoriesQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import {
    GRANULARITIES,
    MAX_BUCKETS,
    bucketCount,
    categoryTotals,
    defaultRange,
    spendingBuckets,
    spendingTotal,
    type Granularity,
    type Range,
} from '@core/charts';
import { toDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { CategoryBreakdown } from './category-breakdown';
import { SpendingBars } from './spending-bars';

import './charts.css';

type Problem = 'rangeInvalid' | 'rangeTooLong';

function Charts() {
    const t = useTranslations('charts');
    const { locale } = useLocale();
    const id = useId();
    const { expenses } = useExpenses();
    const { options, labelOf, styleOf } = useCategoryOptions();
    const categories = useQuery(categoriesQuery());

    const [today] = useState(() => toDateString(new Date()));
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [categoryId, setCategoryId] = useState('');
    // Null until the person picks dates: the range then follows the grouping
    const [picked, setPicked] = useState<Range | null>(null);

    const range = picked ?? defaultRange(granularity, today);
    const problem: Problem | null =
        range.from > range.to ? 'rangeInvalid' : bucketCount(granularity, range) > MAX_BUCKETS ? 'rangeTooLong' : null;

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
        () => spendingBuckets(filed, { granularity, range, categoryId: filter }),
        [filed, granularity, range, filter]
    );
    const total = useMemo(() => spendingTotal(filed, { range, categoryId: filter }), [filed, range, filter]);
    const totals = useMemo(() => categoryTotals(filed, range), [filed, range]);

    return (
        <section className="charts">
            <h1 className="charts__title">{t('title')}</h1>

            <ChoiceGroup
                legend={t('group.title')}
                name="granularity"
                options={GRANULARITIES.map((value) => ({ value, label: t(`group.${value}`) }))}
                value={granularity}
                onChange={setGranularity}
            />

            <div className="charts__field">
                <label htmlFor={`${id}-category`}>{t('category')}</label>
                <CategorySelect
                    id={`${id}-category`}
                    label={t('category')}
                    options={[{ id: '', label: t('allCategories') }, ...options]}
                    value={categoryId}
                    onChange={setCategoryId}
                />
            </div>

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
            {problem === null && <SpendingBars buckets={buckets} granularity={granularity} />}
            {problem !== 'rangeInvalid' && (
                <>
                    <p className="charts__total">
                        <span>{t('total')}</span>
                        <strong>{formatAmount(total, DEFAULT_CURRENCY, locale)}</strong>
                    </p>
                    {totals.length > 0 ? (
                        <CategoryBreakdown totals={totals} labelOf={labelOf} styleOf={styleOf} />
                    ) : (
                        <p className="charts__empty">{t('empty')}</p>
                    )}
                </>
            )}
        </section>
    );
}

export { Charts };
