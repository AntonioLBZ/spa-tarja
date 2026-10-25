import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { readDuration } from '@/lib/motion';
import { paymentOf } from '@core/counting';
import { fromDateString } from '@core/date';
import { groupByDay } from '@core/expense-groups';
import { collapsePlans, planTotal } from '@core/installments';
import { formatAmount } from '@core/money';

import { useExpenseGroups } from './use-expense-groups';
import { useSaveExpense } from './use-save-expense';
import { useShortDate } from './use-short-date';

import type { Expense } from '@core/expense';

import './expense-list.css';

function ExpenseList() {
    const t = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const save = useSaveExpense();
    const { labelOf, styleOf } = useCategoryOptions();
    const { groups, pendingIds, hasData, isError, isWaitingForNetwork } = useExpenseGroups();
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
            <h2 className="expense-list__title">{t('title')}</h2>

            {isError && !hasData && (
                <p className="expense-list__message" role="alert">
                    {t('loadFailed')}
                </p>
            )}
            {hasData && shown.length === 0 && <p className="expense-list__message">{t('empty')}</p>}

            {shown.map((group) => (
                <section className="expense-list__day" key={group.date}>
                    <h3 className="expense-list__date">{dayFormat.format(fromDateString(group.date))}</h3>
                    <ul className="expense-list__items">
                        {collapsePlans(group.expenses).map((item) => {
                            const expenses = item.kind === 'plan' ? item.parts : [item.expense];
                            const expense = expenses[0]!;
                            const category = labelOf(expense.categoryId);
                            const name = expense.text || category;
                            const pending = expenses.some((part) => pendingIds.has(part.id));
                            const isLeaving = leaving.has(expense.id);
                            const lastCharge = expenses.at(-1)!.chargeDate;
                            const charged =
                                item.kind === 'plan'
                                    ? lastCharge && t('plan', { parts: expenses.length, date: shortDate(lastCharge) })
                                    : expense.chargeDate && paymentOf(expense) !== 'direct'
                                      ? t('charged', {
                                            payment: tPayment(paymentOf(expense)),
                                            date: shortDate(expense.chargeDate),
                                        })
                                      : null;
                            return (
                                <li
                                    className={clsx('expense-item', isLeaving && 'expense-item--leaving')}
                                    key={expense.id}
                                >
                                    <span className="expense-item__name">
                                        <CategoryBadge style={styleOf(expense.categoryId)} />
                                        <span className="expense-item__text">{name}</span>
                                    </span>
                                    <span className="expense-item__amount">
                                        {formatAmount(planTotal(expenses), expense.currency, locale)}
                                    </span>
                                    {(expense.text || pending || charged) && (
                                        <span className="expense-item__meta">
                                            {expense.text && <span>{category}</span>}
                                            {charged && <span>{charged}</span>}
                                            {pending && <span className="expense-item__pending">{t('pending')}</span>}
                                        </span>
                                    )}
                                    <button
                                        className="expense-item__delete"
                                        aria-label={t('deleteItem', { name })}
                                        disabled={isLeaving}
                                        type="button"
                                        onClick={() => remove(expenses, Date.now())}
                                    >
                                        {t('delete')}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </section>
    );
}

export { ExpenseList };
