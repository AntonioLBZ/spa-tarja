import clsx from 'clsx';
import { useRef } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { CategorySelect } from '@/features/categories/category-select';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { LIST_GROUPINGS, PAID_WITH, activeFilterCount } from '@core/expense-list';

import type { ListFilters, ListGrouping } from '@core/expense-list';

import './expense-list-controls.css';

interface ExpenseListControlsProps {
    filters: ListFilters;
    grouping: ListGrouping;
    // The rows that pass the filters, and all of them
    shown: number;
    total: number;
    // Whether the search or any filter narrows the list
    filtering: boolean;
    onFiltersChange: (patch: Partial<ListFilters>) => void;
    onGroupingChange: (grouping: ListGrouping) => void;
    onClear: () => void;
}

// The search field and, under a toggle, the grouping and the filters of the expense list; while anything narrows the
// list, a line that says how much of it is left
function ExpenseListControls(props: ExpenseListControlsProps) {
    const { filters, grouping, shown, total, filtering, onFiltersChange, onGroupingChange, onClear } = props;
    const t = useTranslations('expenses.filters');
    const tList = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const { options } = useCategoryOptions();
    const search = useRef<HTMLInputElement>(null);

    // The button goes with the filters, so the focus goes to the field
    function clear() {
        onClear();
        search.current?.focus();
    }

    return (
        <div className="expense-list-controls">
            <Field label={t('search')}>
                {(control) => (
                    <input
                        {...control}
                        ref={search}
                        className="expense-list-controls__search"
                        type="search"
                        value={filters.query}
                        onChange={(event) => onFiltersChange({ query: event.target.value })}
                    />
                )}
            </Field>

            <Disclosure summary={t('toggle', { count: activeFilterCount(filters) })} chevron>
                <ChoiceGroup
                    legend={t('groupBy')}
                    name="list-grouping"
                    options={LIST_GROUPINGS.map((value) => ({ value, label: t(`group.${value}`) }))}
                    value={grouping}
                    onChange={onGroupingChange}
                />
                <Field label={t('category')}>
                    {(control) => (
                        <CategorySelect
                            {...control}
                            label={t('category')}
                            options={[{ id: '', label: t('allCategories') }, ...options]}
                            value={filters.categoryId}
                            onChange={(categoryId) => onFiltersChange({ categoryId })}
                        />
                    )}
                </Field>
                <DateRangeFields
                    allowEmpty
                    from={filters.from}
                    to={filters.to}
                    labels={{ from: t('from'), to: t('to') }}
                    onChange={(edge, day) => onFiltersChange({ [edge]: day })}
                />
                <ChoiceGroup
                    legend={t('paidWith')}
                    name="list-paid-with"
                    options={PAID_WITH.map((value) => ({
                        value,
                        label: value === 'any' || value === 'plan' ? t(`paid.${value}`) : tPayment(value),
                    }))}
                    value={filters.paidWith}
                    onChange={(paidWith) => onFiltersChange({ paidWith })}
                />
            </Disclosure>

            <div className={clsx('expense-list-controls__status', !filtering && 'expense-list-controls__status--idle')}>
                <div role="status">
                    {filtering && (
                        <Notice tone="quiet">{shown === 0 ? tList('noMatch') : t('showing', { shown, total })}</Notice>
                    )}
                </div>
                {filtering && <Button onClick={clear}>{t('clear')}</Button>}
            </div>
        </div>
    );
}

export { ExpenseListControls };
