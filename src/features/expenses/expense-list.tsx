import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { expensesQuery, type ExpensesState } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { isDefaultCategoryId } from '@core/categories';
import { fromDateString } from '@core/date';
import { groupByDay } from '@core/expense-groups';
import { formatAmount } from '@core/money';

import { useSaveExpense } from './use-save-expense';

import './expense-list.css';

function selectGroups(state: ExpensesState) {
    return groupByDay(state.expenses);
}

function ExpenseList() {
    const t = useTranslations('expenses.list');
    const tCategory = useTranslations('categories');
    const { locale } = useLocale();
    const remove = useSaveExpense();
    const expenses = useQuery({ ...expensesQuery(), select: selectGroups });
    const dayFormat = useMemo(
        () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
        [locale]
    );

    if (expenses.isError) {
        return (
            <p className="expense-list__message" role="alert">
                {t('loadFailed')}
            </p>
        );
    }
    if (!expenses.data) return null;

    return (
        <section className="expense-list">
            <h2 className="expense-list__title">{t('title')}</h2>

            {expenses.data.length === 0 && <p className="expense-list__message">{t('empty')}</p>}

            {expenses.data.map((group) => (
                <section className="expense-list__day" key={group.date}>
                    <h3 className="expense-list__date">{dayFormat.format(fromDateString(group.date))}</h3>
                    <ul className="expense-list__items">
                        {group.expenses.map((expense) => {
                            const category = tCategory(
                                isDefaultCategoryId(expense.categoryId) ? expense.categoryId : 'other'
                            );
                            const name = expense.text || category;
                            return (
                                <li className="expense-item" key={expense.id}>
                                    <span className="expense-item__name">{name}</span>
                                    <span className="expense-item__amount">
                                        {formatAmount(expense.amountCents, expense.currency, locale)}
                                    </span>
                                    {expense.text && <span className="expense-item__category">{category}</span>}
                                    <button
                                        className="expense-item__delete"
                                        aria-label={t('deleteItem', { name })}
                                        type="button"
                                        onClick={() => {
                                            const now = Date.now();
                                            remove.mutate({ ...expense, updatedAt: now, deletedAt: now });
                                        }}
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
