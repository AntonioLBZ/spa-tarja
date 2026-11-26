import clsx from 'clsx';
import { useId, type RefCallback } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { canEdit } from '@/features/expenses/data/create-expenses';
import { namesSomeoneWhoLeft } from '@/features/groups/words/names-someone-who-left';
import { isSharedRow } from '@core/groups/shared-expense';

import { ExpenseItemBody } from './expense-item-body';

import type { SharedRowSource } from '@/features/groups/share/use-shared-expense-rows';
import type { Expense } from '@core/expenses/expense';

import '@/features/groups/ledger/ledger-row.css';
import './expense-row.css';

interface ExpenseRowProps {
    /** The expense, or every part of its plan */
    expenses: readonly Expense[];
    isPlan: boolean;
    /** Not on the server yet */
    pending: boolean;
    /** Deleted a moment ago, fading out */
    leaving: boolean;
    /** Starts the details with the day it was made, for a list that is not grouped by day */
    showDate?: boolean;
    /** The group and the entry of a row that is your part of a shared expense */
    source?: SharedRowSource;
    onEdit: (expenses: readonly Expense[]) => void;
    onDuplicate: (expenses: readonly Expense[]) => void;
    onDelete: (expenses: readonly Expense[]) => void;
    /** What takes the focus back once an edit of the expense is over: its toggle, or the row when it has nothing to open */
    toggleRef?: RefCallback<HTMLElement>;
}

// An expense of the list. Pressing it opens a panel under it with what can be done to it.
const ExpenseRow = (props: ExpenseRowProps) => {
    const { expenses, isPlan, pending, leaving, showDate, source, onEdit, onDuplicate, onDelete, toggleRef } = props;
    const t = useTranslations('expenses.list');
    const tLedger = useTranslations('groups.ledger');
    const { labelOf } = useCategoryOptions();
    const reasonId = useId();

    const expense = expenses[0]!;
    const derived = isSharedRow(expense);
    const shared = source && derived ? { row: expense, group: source.group } : null;
    // A plan is edited or duplicated whole, so every part of it has to be here. A shared expense that names somebody who
    // left is not offered to edit, as most edits of it would move what they pay or owe; a copy leaves them out.
    const editable = source ? !namesSomeoneWhoLeft(source.entry, source.group) : canEdit(expenses);
    const copyable = source !== undefined || editable;
    const name = expense.text || labelOf(expense.categoryId);

    const expenseClsx = clsx('expense-item', { 'expense-item--leaving': leaving });
    const body = (
        <ExpenseItemBody
            expenses={expenses}
            isPlan={isPlan}
            pending={pending}
            showDate={showDate}
            shared={shared ?? undefined}
        />
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
        <Disclosure as="li" className={expenseClsx} chevron align="top" toggleRef={toggleRef} summary={body}>
            <Actions>
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
            </Actions>
            {!editable && (
                <Notice tone="quiet" id={reasonId}>
                    {source ? tLedger('leftCantEdit') : t('editIncomplete')}
                </Notice>
            )}
        </Disclosure>
    );
};

export { ExpenseRow, type ExpenseRowProps };
