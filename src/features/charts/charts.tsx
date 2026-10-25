import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { useLocale } from '@/lib/i18n';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import {
    GRANULARITIES,
    categoryTotals,
    defaultRange,
    spendingBuckets,
    type Granularity,
    type Range,
} from '@core/charts';
import { isCalendarDate, toDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { CategoryBreakdown } from './category-breakdown';
import { SpendingBars } from './spending-bars';

import './charts.css';

function Charts() {
    const t = useTranslations('charts');
    const { locale } = useLocale();
    const { expenses } = useExpenses();
    const { options } = useCategoryOptions();

    const [today] = useState(() => toDateString(new Date()));
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [categoryId, setCategoryId] = useState('');
    // Null until the person picks dates: the range then follows the grouping
    const [picked, setPicked] = useState<Range | null>(null);

    const range = picked ?? defaultRange(granularity, today);
    const invalid = range.from > range.to;

    // An expense whose category is gone counts under the fallback, as it reads in the list
    const known = useMemo(() => new Set(options.map((option) => option.id)), [options]);
    const filed = useMemo(
        () =>
            expenses.map((item) => (known.has(item.categoryId) ? item : { ...item, categoryId: FALLBACK_CATEGORY_ID })),
        [expenses, known]
    );
    const filter = known.has(categoryId) ? categoryId : null;

    const buckets = spendingBuckets(filed, { granularity, range, categoryId: filter });
    const totals = categoryTotals(filed, range);
    const total = buckets.reduce((sum, bucket) => sum + bucket.totalCents, 0);

    // The date field gives an empty value while it is half typed
    function pickDate(edge: keyof Range, value: string) {
        if (isCalendarDate(value)) setPicked({ ...range, [edge]: value });
    }

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
                <label htmlFor="charts-category">{t('category')}</label>
                <select id="charts-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">{t('allCategories')}</option>
                    {options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="charts__dates">
                <div className="charts__field">
                    <label htmlFor="charts-from">{t('from')}</label>
                    <input
                        id="charts-from"
                        aria-invalid={invalid}
                        type="date"
                        value={range.from}
                        onChange={(event) => pickDate('from', event.target.value)}
                    />
                </div>
                <div className="charts__field">
                    <label htmlFor="charts-to">{t('to')}</label>
                    <input
                        id="charts-to"
                        aria-invalid={invalid}
                        type="date"
                        value={range.to}
                        onChange={(event) => pickDate('to', event.target.value)}
                    />
                </div>
            </div>
            {picked && (
                <button className="charts__reset" type="button" onClick={() => setPicked(null)}>
                    {t('resetRange')}
                </button>
            )}

            {invalid ? (
                <p className="charts__error" role="alert">
                    {t('rangeInvalid')}
                </p>
            ) : (
                <>
                    <SpendingBars buckets={buckets} granularity={granularity} />
                    <p className="charts__total">
                        <span>{t('total')}</span>
                        <strong>{formatAmount(total, DEFAULT_CURRENCY, locale)}</strong>
                    </p>
                    {totals.length > 0 ? (
                        <CategoryBreakdown totals={totals} />
                    ) : (
                        <p className="charts__empty">{t('empty')}</p>
                    )}
                </>
            )}
        </section>
    );
}

export { Charts };
