import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
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
import { isCalendarDate, toDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { CategoryBreakdown } from './category-breakdown';
import { SpendingBars } from './spending-bars';

import './charts.css';

// The years a day can be picked in. A date field passes through 0002, 0020 and 0202 while a year is typed, and none
// of those is a day anybody means.
const FIRST_DAY = '2000-01-01';
const LAST_DAY = '2099-12-31';

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
    // What a date field holds while it doesn't make a day yet, so that typing in it isn't undone
    const [drafts, setDrafts] = useState<Partial<Record<keyof Range, string>>>({});

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

    function editDate(edge: keyof Range, value: string) {
        if (isCalendarDate(value) && value >= FIRST_DAY && value <= LAST_DAY) {
            setPicked({ ...range, [edge]: value });
            setDrafts((current) => ({ ...current, [edge]: undefined }));
        } else {
            setDrafts((current) => ({ ...current, [edge]: value }));
        }
    }

    function resetRange() {
        setPicked(null);
        setDrafts({});
    }

    const dateField = (edge: keyof Range, label: string) => (
        <div className="charts__field">
            <label htmlFor={`${id}-${edge}`}>{label}</label>
            <input
                id={`${id}-${edge}`}
                aria-describedby={problem ? `${id}-problem` : undefined}
                aria-invalid={problem !== null}
                max={LAST_DAY}
                min={FIRST_DAY}
                type="date"
                value={drafts[edge] ?? range[edge]}
                onBlur={() => setDrafts((current) => ({ ...current, [edge]: undefined }))}
                onChange={(event) => editDate(edge, event.target.value)}
            />
        </div>
    );

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

            <div className="charts__dates">
                {dateField('from', t('from'))}
                {dateField('to', t('to'))}
            </div>
            {picked && (
                <button className="charts__reset" type="button" onClick={resetRange}>
                    {t('resetRange')}
                </button>
            )}

            {problem && (
                <p className="charts__error" id={`${id}-problem`} role="alert">
                    {t(problem)}
                </p>
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
