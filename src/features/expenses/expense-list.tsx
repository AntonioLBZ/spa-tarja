import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { useLocale } from '@/lib/i18n';
import { isDefaultCategoryId } from '@core/categories';
import { fromDateString } from '@core/date';
import { formatAmount } from '@core/money';

import { useExpenseGroups } from './use-expense-groups';
import { useSaveExpense } from './use-save-expense';

import './expense-list.css';

function ExpenseList() {
    const t = useTranslations('expenses.list');
    const tCategory = useTranslations('categories');
    const { locale } = useLocale();
    const save = useSaveExpense();
    const { groups, pendingIds, hasData, isError, isWaitingForNetwork } = useExpenseGroups();
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
            {hasData && groups.length === 0 && <p className="expense-list__message">{t('empty')}</p>}

            {groups.map((group) => (
                <section className="expense-list__day" key={group.date}>
                    <h3 className="expense-list__date">{dayFormat.format(fromDateString(group.date))}</h3>
                    <ul className="expense-list__items">
                        {group.expenses.map((expense) => {
                            const category = tCategory(
                                isDefaultCategoryId(expense.categoryId) ? expense.categoryId : 'other'
                            );
                            const name = expense.text || category;
                            const pending = pendingIds.has(expense.id);
                            return (
                                <li className="expense-item" key={expense.id}>
                                    <span className="expense-item__name">{name}</span>
                                    <span className="expense-item__amount">
                                        {formatAmount(expense.amountCents, expense.currency, locale)}
                                    </span>
                                    {(expense.text || pending) && (
                                        <span className="expense-item__meta">
                                            {expense.text && <span>{category}</span>}
                                            {pending && <span className="expense-item__pending">{t('pending')}</span>}
                                        </span>
                                    )}
                                    <button
                                        className="expense-item__delete"
                                        aria-label={t('deleteItem', { name })}
                                        type="button"
                                        onClick={() => {
                                            const now = Date.now();
                                            void save({ ...expense, updatedAt: now, deletedAt: now });
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
