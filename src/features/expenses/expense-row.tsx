import clsx from 'clsx';
import { useId, type RefCallback } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { namesSomeoneWhoLeft } from '@/features/groups/names-someone-who-left';
import { SharedRowDetails } from '@/features/groups/shared-row-details';
import { useLocale } from '@/lib/i18n';
import { countedCents, paymentOf } from '@core/counting';
import { planTotal } from '@core/installments';
import { formatAmount } from '@core/money';
import { isSharedRow } from '@core/shared-expense';

import { canEdit } from './create-expenses';
import { useShortDate } from './use-short-date';

import type { SharedRowSource } from '@/features/groups/use-shared-expense-rows';
import type { Expense } from '@core/expense';

import '@/features/groups/ledger-row.css';
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
    // The group and the entry of a row that is your part of a shared expense
    source?: SharedRowSource;
    onEdit: (expenses: readonly Expense[]) => void;
    onDuplicate: (expenses: readonly Expense[]) => void;
    onDelete: (expenses: readonly Expense[]) => void;
    // What takes the focus back once an edit of the expense is over: its toggle, or the row when it has nothing to open
    toggleRef?: RefCallback<HTMLElement>;
}

// An expense of the list. Pressing it opens a panel under it with what can be done to it.
const ExpenseRow = (props: ExpenseRowProps) => {
    const { expenses, isPlan, pending, leaving, showDate, source, onEdit, onDuplicate, onDelete, toggleRef } = props;
    const t = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const tLedger = useTranslations('groups.ledger');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const { labelOf, styleOf } = useCategoryOptions();
    const reasonId = useId();

    const expense = expenses[0]!;
    const derived = isSharedRow(expense);
    const shared = source && derived ? { row: expense, group: source.group } : null;
    // A plan is edited or duplicated whole, so every part of it has to be here. A shared expense that names somebody who
    // left is not offered to edit, as most edits of it would move what they pay or owe; a copy leaves them out.
    const editable = source ? !namesSomeoneWhoLeft(source.entry, source.group) : canEdit(expenses);
    const copyable = source !== undefined || editable;
    const category = labelOf(expense.categoryId);
    const name = expense.text || category;
    const lastCharge = expenses.at(-1)!.chargeDate;
    const charged = isPlan
        ? lastCharge && t('plan', { parts: expenses.length, date: shortDate(lastCharge) })
        : expense.chargeDate && paymentOf(expense) !== 'direct'
          ? t('charged', { payment: tPayment(paymentOf(expense)), date: shortDate(expense.chargeDate) })
          : null;
    // A restaurant card expense shows your part, and what the card paid when others pay back the rest; a shared one says
    // who paid instead
    const amountCents = isPlan ? planTotal(expenses) : countedCents(expense);
    const paid =
        !isPlan && !shared && amountCents !== expense.amountCents
            ? t('paid', { total: formatAmount(expense.amountCents, expense.currency, locale) })
            : null;

    const expenseClsx = clsx('expense-item', { 'expense-item--leaving': leaving });
    const body = (
        <span className="expense-item__body">
            <span className="expense-item__name">
                <CategoryBadge style={styleOf(expense.categoryId)} />
                <span className="expense-item__text">{name}</span>
            </span>
            <span className="expense-item__amount">{formatAmount(amountCents, expense.currency, locale)}</span>
            {(showDate || expense.text || shared || pending || charged || paid) && (
                <span className="expense-item__meta">
                    {showDate && <span>{shortDate(expense.date)}</span>}
                    {expense.text && <span>{category}</span>}
                    {shared && <SharedRowDetails row={shared.row} group={shared.group} />}
                    {charged && <span>{charged}</span>}
                    {paid && <span>{paid}</span>}
                    {pending && <span className="expense-item__pending">{t('pending')}</span>}
                </span>
            )}
        </span>
    );

    // The entry of a closed group is read-only, and so is a part of a shared expense with no entry to act on: it is never
    // changed as an expense of one's own
    if (derived && (!shared || shared.group.closed !== null)) {
        return (
            <li ref={toggleRef} className={clsx(expenseClsx, 'ledger-row')} tabIndex={-1}>
                {body}
            </li>
        );
    }

    return (
        <Disclosure as="li" className={expenseClsx} chevron toggleRef={toggleRef} summary={body}>
            <div className="expense-item__actions">
                <Button
                    ghost
                    aria-describedby={editable ? undefined : reasonId}
                    aria-label={t('editItem', { name })}
                    disabled={leaving || !editable}
                    onClick={() => onEdit(expenses)}
                >
                    {t('edit')}
                </Button>
                <Button
                    ghost
                    aria-describedby={copyable ? undefined : reasonId}
                    aria-label={t('duplicateItem', { name })}
                    disabled={leaving || !copyable}
                    onClick={() => onDuplicate(expenses)}
                >
                    {t('duplicate')}
                </Button>
                <Button
                    ghost
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
                    {source ? tLedger('leftCantEdit') : t('editIncomplete')}
                </Notice>
            )}
        </Disclosure>
    );
};

export { ExpenseRow, type ExpenseRowProps };
