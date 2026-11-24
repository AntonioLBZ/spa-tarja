import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { PrintTable } from '@/components/print-table/print-table';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { ExpenseListControls } from '@/features/expenses/expense-list-controls';
import { useShortDate } from '@/features/expenses/use-short-date';
import { useYourExpenses } from '@/features/expenses/use-your-expenses';
import { useGroupTitles } from '@/features/groups/use-group-options';
import { useGroups } from '@/features/groups/use-ledgers';
import { useMoney } from '@/lib/amounts';
import { useLocale } from '@/lib/i18n';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import { paymentOf } from '@core/counting';
import { toDateString } from '@core/date';
import {
    JUST_ME,
    NO_FILTERS,
    activeFilterCount,
    hasFilters,
    itemCents,
    listItems,
    listTable,
    openingFilters,
    shownExpense,
} from '@core/expense-list';
import { isSharedRow } from '@core/shared-expense';

import type { Expense } from '@core/expense';
import type { ListContext, ListFilters } from '@core/expense-list';

import './print-expenses.css';

// The person's expenses as the list shows them, in one table to print or save as a PDF: their part of a shared one, a
// plan once at its full price on the day it was made, and the list's filters and sums
const PrintExpenses = () => {
    const t = useTranslations('settings.print');
    const tList = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const tFilters = useTranslations('expenses.filters');
    const { expenses, hasData, neverPulled, isError } = useYourExpenses();
    const { options, labelOf } = useCategoryOptions();
    const { groups } = useGroups();
    const titles = useGroupTitles(groups);
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const money = useMoney();

    // What the page opens on, the month of the list, which does not count as a filter in use
    const [opening] = useState(() => openingFilters(toDateString(new Date())));
    const [filters, setFilters] = useState<ListFilters>(opening);
    const query = useDeferredValue(filters.query);
    const applied = useMemo(() => ({ ...filters, query }), [filters, query]);

    const known = useMemo(() => new Set(options.map((option) => option.id)), [options]);
    const context = useMemo<ListContext>(
        () => ({
            categoryOf: (categoryId) => (known.has(categoryId) ? categoryId : FALLBACK_CATEGORY_ID),
            labelOf,
            groupNameOf: (groupId) => titles.get(groupId) ?? '',
            searchTexts: new WeakMap<Expense, string>(),
            locale,
        }),
        [known, labelOf, titles, locale]
    );
    const items = useMemo(() => listItems(expenses), [expenses]);
    const table = useMemo(() => listTable(items, applied, context), [items, applied, context]);

    // What the table holds, in words, which paper keeps too: the days, then each filter in use
    const caption = (() => {
        const from = applied.from && shortDate(applied.from);
        const to = applied.to && shortDate(applied.to);
        const days =
            from && to
                ? t('range.between', { from, to })
                : from
                  ? t('range.from', { from })
                  : to
                    ? t('range.to', { to })
                    : t('range.all');
        const category = applied.categoryId && labelOf(applied.categoryId);
        const paidWith =
            applied.paidWith === 'any'
                ? ''
                : applied.paidWith === 'plan'
                  ? tFilters('paid.plan')
                  : tPayment(applied.paidWith);
        const sharedWith =
            applied.sharedWith === ''
                ? ''
                : applied.sharedWith === JUST_ME
                  ? tFilters('shared.me')
                  : context.groupNameOf(applied.sharedWith);
        const search = applied.query.trim() && t('search', { query: applied.query.trim() });
        return [days, category, paidWith, sharedWith, search].filter(Boolean).join(' · ');
    })();

    const changeFilters = (patch: Partial<ListFilters>) => setFilters((current) => ({ ...current, ...patch }));

    return (
        <section className="print-expenses">
            <ScreenTitle>{t('title')}</ScreenTitle>
            <p className="hint screen-only">{t('hint')}</p>
            {isError && (!hasData || neverPulled) && (
                <Notice tone="quiet" role="alert">
                    {tList('loadFailed')}
                </Notice>
            )}
            {hasData && items.length === 0 && <Notice tone="quiet">{tList('empty')}</Notice>}
            {items.length > 0 && (
                <div className="print-expenses__controls screen-only">
                    <Actions>
                        <Button disabled={table.items.length === 0} onClick={() => window.print()}>
                            {t('print')}
                        </Button>
                    </Actions>
                    <ExpenseListControls
                        filters={filters}
                        shown={table.items.length}
                        total={items.length}
                        filtering={hasFilters(applied, opening)}
                        filterCount={activeFilterCount(filters, opening)}
                        onFiltersChange={changeFilters}
                        onClear={() => setFilters(NO_FILTERS)}
                    />
                </div>
            )}
            {items.length > 0 && table.items.length === 0 && <Notice tone="quiet">{tList('noMatch')}</Notice>}
            {table.items.length > 0 && (
                <PrintTable caption={caption}>
                    <thead>
                        <tr>
                            <th scope="col">{t('columns.date')}</th>
                            <th scope="col">{t('columns.text')}</th>
                            <th scope="col">{t('columns.category')}</th>
                            <th scope="col">{t('columns.payment')}</th>
                            <th scope="col">{t('columns.group')}</th>
                            <th className="print-table__end" scope="col">
                                {t('columns.amount')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {table.items.map((item) => {
                            const expense = shownExpense(item);
                            const payment =
                                item.kind === 'plan'
                                    ? t('plan', { parts: item.parts[0]!.plan?.parts ?? item.parts.length })
                                    : tPayment(paymentOf(expense));
                            return (
                                <tr key={item.kind === 'plan' ? item.planId : expense.id}>
                                    <td className="print-table__date">{shortDate(expense.date)}</td>
                                    <th scope="row">{expense.text || labelOf(expense.categoryId)}</th>
                                    <td>{labelOf(expense.categoryId)}</td>
                                    <td>{payment}</td>
                                    <td>{isSharedRow(expense) ? context.groupNameOf(expense.shared.groupId) : ''}</td>
                                    <td className="print-table__number">{money(itemCents(item), expense.currency)}</td>
                                </tr>
                            );
                        })}
                        <tr className="print-table__sum print-table__sum--last">
                            <th scope="row" colSpan={5}>
                                {t('total')}
                            </th>
                            <td className="print-table__number">{money(table.totalCents)}</td>
                        </tr>
                    </tbody>
                </PrintTable>
            )}
        </section>
    );
};

export { PrintExpenses };
