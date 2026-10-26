import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Notice } from '@/components/notice/notice';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';
import { shownExpense } from '@core/expense-list';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { useAddForm } from './add-form-state';
import { ExpenseListControls } from './expense-list-controls';
import { ExpenseRow } from './expense-row';
import { useExpenseList } from './use-expense-list';
import { useSaveExpense } from './use-save-expense';

import type { Expense } from '@core/expense';
import type { ListGroup } from '@core/expense-list';

import './expense-list.css';

function ExpenseList() {
    const t = useTranslations('expenses.list');
    const { locale } = useLocale();
    const save = useSaveExpense();
    const { editing, startEdit, endEdit, refocus, clearRefocus } = useAddForm();
    const list = useExpenseList();
    const { groups, grouping, leaving, pendingIds, hasData, isError, isWaitingForNetwork } = list;
    const { labelOf, styleOf } = useCategoryOptions();
    // The toggle of each row by the id of its expense, and the title, where the focus goes back after an edit
    const toggles = useRef(new Map<string, HTMLButtonElement>());
    const title = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (refocus === null) return;
        (toggles.current.get(refocus) ?? title.current)?.focus();
        clearRefocus();
    }, [refocus, clearRefocus]);
    // The expense of the row that "Show more" brought in first, which takes the focus once the row is there
    const moreFocus = useRef<string | null>(null);
    useEffect(() => {
        if (moreFocus.current === null) return;
        (toggles.current.get(moreFocus.current) ?? title.current)?.focus();
        moreFocus.current = null;
    });

    // The row the focus goes to when a row is deleted: the next one that stays, else the one before it. A row fading
    // out doesn't stay.
    function neighbourOf(rowId: string): string | undefined {
        const staying = groups
            .flatMap((group) => group.items.map((item) => shownExpense(item).id))
            .filter((id) => id === rowId || !leaving.has(id));
        const at = staying.indexOf(rowId);
        return staying[at + 1] ?? (at > 0 ? staying[at - 1] : undefined);
    }

    // All the parts of a plan go together. The focus leaves the button that is going away for a neighbour row, or the
    // title when there is none.
    function remove(expenses: readonly Expense[], now: number) {
        const neighbour = neighbourOf(expenses[0]!.id);
        void save(
            expenses.map((expense) => {
                const at = Math.max(now, expense.updatedAt + 1);
                return { ...expense, updatedAt: at, deletedAt: at };
            })
        );
        if (editing && expenses.some((expense) => expense.id === editing[0]!.id)) endEdit();
        list.fadeOut(expenses);
        ((neighbour && toggles.current.get(neighbour)) || title.current)?.focus();
    }

    // Days, weeks and months say the year only when the list goes over a New Year
    const formats = useMemo(() => {
        const year = list.spansYears ? ({ year: 'numeric' } as const) : {};
        return {
            day: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', ...year }),
            week: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...year }),
            month: new Intl.DateTimeFormat(locale, { month: 'long', ...year }),
        };
    }, [locale, list.spansYears]);

    function labelOfGroup(group: ListGroup) {
        if (grouping === 'category') {
            return (
                <>
                    <CategoryBadge style={styleOf(group.key)} />
                    {labelOf(group.key)}
                </>
            );
        }
        const day = fromDateString(group.key);
        return grouping === 'week' ? t('weekOf', { date: formats.week.format(day) }) : formats[grouping].format(day);
    }

    // Still loading: nothing to show yet, and not waiting for a connection that may take long
    if (!hasData && !isError && !isWaitingForNetwork) return null;

    return (
        <section className="expense-list">
            <h2 className="expense-list__title" ref={title} tabIndex={-1}>
                {t('title')}
            </h2>

            {isError && !hasData && (
                <Notice tone="quiet" role="alert">
                    {t('loadFailed')}
                </Notice>
            )}
            {hasData && list.total === 0 && <Notice tone="quiet">{t('empty')}</Notice>}
            {list.total > 0 && (
                <ExpenseListControls
                    filters={list.filters}
                    grouping={grouping}
                    shown={list.shown}
                    total={list.total}
                    filtering={list.filtering}
                    onFiltersChange={list.changeFilters}
                    onGroupingChange={list.changeGrouping}
                    onClear={list.clearFilters}
                />
            )}

            {groups.map((group) => (
                <section className="expense-list__group" key={group.key}>
                    <div className="expense-list__header">
                        <h3
                            className={clsx(
                                'expense-list__label',
                                grouping === 'category' ? 'expense-list__label--category' : 'expense-list__label--date'
                            )}
                        >
                            {labelOfGroup(group)}
                        </h3>
                        <span className="expense-list__subtotal">
                            <span className="visually-hidden">{t('groupTotal')}</span>{' '}
                            {formatAmount(group.totalCents, DEFAULT_CURRENCY, locale)}
                        </span>
                    </div>
                    <CardList flush>
                        {group.items.map((item) => {
                            const expenses = item.kind === 'plan' ? item.parts : [item.expense];
                            const first = expenses[0]!;
                            return (
                                <ExpenseRow
                                    key={first.id}
                                    expenses={expenses}
                                    isPlan={item.kind === 'plan'}
                                    pending={expenses.some((part) => pendingIds.has(part.id))}
                                    leaving={leaving.has(first.id)}
                                    showDate={grouping !== 'day'}
                                    onEdit={startEdit}
                                    onDelete={(parts) => remove(parts, Date.now())}
                                    toggleRef={(node) => {
                                        if (node) toggles.current.set(first.id, node);
                                        return () => {
                                            toggles.current.delete(first.id);
                                        };
                                    }}
                                />
                            );
                        })}
                    </CardList>
                </section>
            ))}

            {list.hiddenRows > 0 && (
                <Button className="expense-list__more" onClick={() => (moreFocus.current = list.showMore())}>
                    {t('showMore')}
                </Button>
            )}
        </section>
    );
}

export { ExpenseList };
