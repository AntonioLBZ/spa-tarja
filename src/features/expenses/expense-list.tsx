import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { CardList } from '@/components/card/card';
import { Notice } from '@/components/notice/notice';
import { useLocale } from '@/lib/i18n';
import { readDuration } from '@/lib/motion';
import { fromDateString } from '@core/date';
import { groupByDay } from '@core/expense-groups';
import { collapsePlans } from '@core/installments';

import { useAddForm } from './add-form-state';
import { ExpenseRow } from './expense-row';
import { useExpenseGroups } from './use-expense-groups';
import { useSaveExpense } from './use-save-expense';

import type { Expense } from '@core/expense';

import './expense-list.css';

function ExpenseList() {
    const t = useTranslations('expenses.list');
    const { locale } = useLocale();
    const save = useSaveExpense();
    const { editing, startEdit, endEdit, refocus, clearRefocus } = useAddForm();
    const { groups, pendingIds, hasData, isError, isWaitingForNetwork } = useExpenseGroups();
    // The toggle of each row by the id of its expense, and the title, where the focus goes back after an edit
    const toggles = useRef(new Map<string, HTMLButtonElement>());
    const title = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (refocus === null) return;
        (toggles.current.get(refocus) ?? title.current)?.focus();
        clearRefocus();
    }, [refocus, clearRefocus]);
    // Expenses deleted a moment ago, kept on screen until their fade-out is over
    const [leaving, setLeaving] = useState<ReadonlyMap<string, Expense>>(new Map());
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach(clearTimeout);
    }, []);
    const shown = useMemo(() => {
        if (leaving.size === 0) return groups;
        const live = groups.flatMap((group) => group.expenses);
        const liveIds = new Set(live.map((expense) => expense.id));
        return groupByDay([...live, ...[...leaving.values()].filter((expense) => !liveIds.has(expense.id))]);
    }, [groups, leaving]);

    // All the parts of a plan go together
    function remove(expenses: readonly Expense[], now: number) {
        void save(expenses.map((expense) => ({ ...expense, updatedAt: now, deletedAt: now })));
        if (editing && expenses.some((expense) => expense.id === editing[0]!.id)) endEdit();

        const duration = readDuration('--duration-base');
        if (duration === 0) return;
        setLeaving((current) => new Map([...current, ...expenses.map((expense) => [expense.id, expense] as const)]));
        const timer = setTimeout(() => {
            timers.current.delete(timer);
            setLeaving((current) => {
                const next = new Map(current);
                for (const expense of expenses) next.delete(expense.id);
                return next;
            });
        }, duration);
        timers.current.add(timer);
    }

    const dayFormat = useMemo(
        () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
        [locale]
    );

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
            {hasData && shown.length === 0 && <Notice tone="quiet">{t('empty')}</Notice>}

            {shown.map((group) => (
                <section className="expense-list__day" key={group.date}>
                    <h3 className="expense-list__date">{dayFormat.format(fromDateString(group.date))}</h3>
                    <CardList flush>
                        {collapsePlans(group.expenses).map((item) => {
                            const expenses = item.kind === 'plan' ? item.parts : [item.expense];
                            const first = expenses[0]!;
                            return (
                                <ExpenseRow
                                    key={first.id}
                                    expenses={expenses}
                                    isPlan={item.kind === 'plan'}
                                    pending={expenses.some((part) => pendingIds.has(part.id))}
                                    leaving={leaving.has(first.id)}
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
        </section>
    );
}

export { ExpenseList };
