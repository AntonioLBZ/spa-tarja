import clsx from 'clsx';
import { useId, type Ref } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { countedCents, paymentOf } from '@core/counting';
import { planTotal } from '@core/installments';
import { formatAmount } from '@core/money';

import { canEdit } from './create-expenses';
import { useShortDate } from './use-short-date';

import type { Expense } from '@core/expense';

import './expense-row.css';

interface ExpenseRowProps {
    // The expense, or every part of its plan
    expenses: readonly Expense[];
    isPlan: boolean;
    // Not on the server yet
    pending: boolean;
    // Deleted a moment ago, fading out
    leaving: boolean;
    // Starts the details with the day it was made, for a list that is not grouped by day
    showDate?: boolean;
    onEdit: (expenses: readonly Expense[]) => void;
    onDuplicate: (expenses: readonly Expense[]) => void;
    onDelete: (expenses: readonly Expense[]) => void;
    // Of the toggle, which takes the focus back once an edit of the expense is over
    toggleRef?: Ref<HTMLButtonElement>;
}

// An expense of the list. Pressing it opens a panel under it with what can be done to it.
const ExpenseRow = (props: ExpenseRowProps) => {
    const { expenses, isPlan, pending, leaving, showDate, onEdit, onDuplicate, onDelete, toggleRef } = props;
    const t = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const { labelOf, styleOf } = useCategoryOptions();
    const reasonId = useId();

    const expense = expenses[0]!;
    // A plan is edited or duplicated whole, so every part of it has to be here
    const editable = canEdit(expenses);
    const category = labelOf(expense.categoryId);
    const name = expense.text || category;
    const lastCharge = expenses.at(-1)!.chargeDate;
    const charged = isPlan
        ? lastCharge && t('plan', { parts: expenses.length, date: shortDate(lastCharge) })
        : expense.chargeDate && paymentOf(expense) !== 'direct'
          ? t('charged', { payment: tPayment(paymentOf(expense)), date: shortDate(expense.chargeDate) })
          : null;
    // A restaurant card expense shows your part, and what the card paid when others pay back the rest
    const amountCents = isPlan ? planTotal(expenses) : countedCents(expense);
    const paid =
        !isPlan && amountCents !== expense.amountCents
            ? t('paid', { total: formatAmount(expense.amountCents, expense.currency, locale) })
            : null;

    const expenseClsx = clsx('expense-item', { 'expense-item--leaving': leaving });

    return (
        <Disclosure
            as="li"
            className={expenseClsx}
            chevron
            toggleRef={toggleRef}
            summary={
                <span className="expense-item__body">
                    <span className="expense-item__name">
                        <CategoryBadge style={styleOf(expense.categoryId)} />
                        <span className="expense-item__text">{name}</span>
                    </span>
                    <span className="expense-item__amount">{formatAmount(amountCents, expense.currency, locale)}</span>
                    {(showDate || expense.text || pending || charged || paid) && (
                        <span className="expense-item__meta">
                            {showDate && <span>{shortDate(expense.date)}</span>}
                            {expense.text && <span>{category}</span>}
                            {charged && <span>{charged}</span>}
                            {paid && <span>{paid}</span>}
                            {pending && <span className="expense-item__pending">{t('pending')}</span>}
                        </span>
                    )}
                </span>
            }
        >
            <div className="expense-item__actions">
                <Button
                    aria-describedby={editable ? undefined : reasonId}
                    aria-label={t('editItem', { name })}
                    disabled={leaving || !editable}
                    onClick={() => onEdit(expenses)}
                >
                    {t('edit')}
                </Button>
                <Button
                    aria-describedby={editable ? undefined : reasonId}
                    aria-label={t('duplicateItem', { name })}
                    disabled={leaving || !editable}
                    onClick={() => onDuplicate(expenses)}
                >
                    {t('duplicate')}
                </Button>
                <Button
                    variant="danger"
                    aria-label={t('deleteItem', { name })}
                    disabled={leaving}
                    onClick={() => onDelete(expenses)}
                >
                    {t('delete')}
                </Button>
            </div>
            {!editable && (
                <Notice tone="quiet" id={reasonId}>
                    {t('editIncomplete')}
                </Notice>
            )}
        </Disclosure>
    );
};

export { ExpenseRow, type ExpenseRowProps };
