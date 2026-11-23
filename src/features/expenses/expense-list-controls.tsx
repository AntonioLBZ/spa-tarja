import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Select } from '@/components/select/select';
import { CategorySelect } from '@/features/categories/category-select';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { groupsFirst, useGroupOptions } from '@/features/groups/use-group-options';
import { useGroups } from '@/features/groups/use-ledgers';
import { JUST_ME, LIST_GROUPINGS, PAID_WITH } from '@core/expense-list';

import { FilterStatus } from './filter-status';
import { FiltersSheet } from './filters-sheet';
import { ListSearchField } from './list-search-field';

import type { IconName } from '@/components/icon/icon-paths';
import type { ListFilters, ListGrouping, PaidWith } from '@core/expense-list';

import './expense-list-controls.css';

const GROUPING_ICONS: Record<ListGrouping, IconName> = {
    day: 'today',
    week: 'date_range',
    month: 'calendar_month',
    category: 'category',
};

const PAID_WITH_ICONS: Record<PaidWith, IconName> = {
    any: 'wallet',
    direct: 'payments',
    credit: 'credit_card',
    voucher: 'confirmation_number',
    plan: 'event_repeat',
};

interface ExpenseListControlsProps {
    filters: ListFilters;
    grouping: ListGrouping;
    // The rows that pass the filters, and all of them
    shown: number;
    total: number;
    // Whether the search or any filter narrows the list
    filtering: boolean;
    // How many of the filters of the panel are in use
    filterCount: number;
    onFiltersChange: (patch: Partial<ListFilters>) => void;
    onGroupingChange: (grouping: ListGrouping) => void;
    onClear: () => void;
}

// The search field and, at its right, a button that opens the grouping and the filters of the expense list in a sheet;
// while anything narrows the list, a line that says how much of it is left
const ExpenseListControls = (props: ExpenseListControlsProps) => {
    const { filters, grouping, shown, total, filtering, filterCount, onFiltersChange, onGroupingChange, onClear } =
        props;
    const t = useTranslations('expenses.filters');
    const tPayment = useTranslations('expenses.payment');
    const { options } = useCategoryOptions();
    const { groups } = useGroups();
    // The groups and friends whose expenses can be in the list, closed ones too
    const listed = useMemo(() => groupsFirst(groups.filter((group) => group.showInExpenses)), [groups]);
    const groupOptions = useGroupOptions(listed);
    const toggle = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);

    // The button goes with the filters: the focus goes to the filters button, never to the field, whose keyboard would open
    const clear = () => {
        onClear();
        toggle.current?.focus();
    };

    // The filters of the sheet, the dates too; the search and the grouping stay
    const clearFilters = () => onFiltersChange({ categoryId: '', from: '', to: '', paidWith: 'any', sharedWith: '' });

    const close = () => {
        setOpen(false);
        toggle.current?.focus();
    };

    return (
        <div className="expense-list-controls">
            <div className="expense-list-controls__row">
                <ListSearchField
                    className="expense-list-controls__search-field"
                    value={filters.query}
                    onChange={(query) => onFiltersChange({ query })}
                />
                <Button
                    ref={toggle}
                    ghost
                    glyph
                    aria-haspopup="dialog"
                    aria-label={t('toggle', { count: filterCount })}
                    badge={filterCount > 0 ? filterCount : undefined}
                    onClick={() => setOpen(true)}
                >
                    <Icon name="filter_list" />
                </Button>
            </div>

            <FiltersSheet
                open={open}
                inUse={filterCount > 0}
                filtering={filtering}
                shown={shown}
                total={total}
                onClearFilters={clearFilters}
                onClose={close}
            >
                <Field label={t('groupBy')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={LIST_GROUPINGS.map((value) => ({
                                value,
                                label: t(`group.${value}`),
                                icon: <Icon name={GROUPING_ICONS[value]} />,
                            }))}
                            value={grouping}
                            onChange={onGroupingChange}
                        />
                    )}
                </Field>
                <Field label={t('category')}>
                    {(control) => (
                        <CategorySelect
                            {...control}
                            options={[{ id: '', label: t('allCategories'), icon: <Icon name="apps" /> }, ...options]}
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
                <Field label={t('paidWith')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={PAID_WITH.map((value) => ({
                                value,
                                label: value === 'any' || value === 'plan' ? t(`paid.${value}`) : tPayment(value),
                                icon: <Icon name={PAID_WITH_ICONS[value]} />,
                            }))}
                            value={filters.paidWith}
                            onChange={(paidWith) => onFiltersChange({ paidWith })}
                        />
                    )}
                </Field>
                <Field label={t('sharedWith')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={[
                                { value: '', label: t('shared.anyone'), icon: <Icon name="groups" /> },
                                { value: JUST_ME, label: t('shared.me'), icon: <Icon name="account_circle" /> },
                                ...groupOptions,
                            ]}
                            value={filters.sharedWith}
                            onChange={(sharedWith) => onFiltersChange({ sharedWith })}
                        />
                    )}
                </Field>
            </FiltersSheet>

            <FilterStatus filtering={filtering} shown={shown} total={total} onClear={clear} />
        </div>
    );
};

export { ExpenseListControls, type ExpenseListControlsProps };
