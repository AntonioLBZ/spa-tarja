import { useTranslations } from 'use-intl';

import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { SharedRowDetails } from '@/features/groups/share/shared-row-details';
import { useMoney } from '@/lib/amounts';
import { countedCents, paymentOf } from '@core/counting';
import { planTotal } from '@core/installments';

import { useShortDate } from './use-short-date';

import type { Expense } from '@core/expense';
import type { SharedExpenseRow } from '@core/shared-expense';
import type { SharedGroup } from '@core/shared-group';

import './expense-row.css';

interface ExpenseItemBodyProps {
    // The expense, or every part of its plan
    expenses: readonly Expense[];
    isPlan: boolean;
    // Not on the server yet
    pending: boolean;
    // Starts the details with the day it was made
    showDate?: boolean;
    // A row that is your part of a shared expense, and its group
    shared?: { row: SharedExpenseRow; group: SharedGroup };
}

// What a row of expenses shows: the icon, the name and the amount, and the details under them. A part of a plan shown
// on its own says which part it is.
const ExpenseItemBody = (props: ExpenseItemBodyProps) => {
    const { expenses, isPlan, pending, showDate, shared } = props;
    const t = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const money = useMoney();
    const shortDate = useShortDate();
    const { labelOf, styleOf } = useCategoryOptions();

    const expense = expenses[0]!;
    const category = labelOf(expense.categoryId);
    const name = expense.text || category;
    const lastCharge = expenses.at(-1)!.chargeDate;
    const charged = isPlan
        ? lastCharge && t('plan', { parts: expenses.length, date: shortDate(lastCharge) })
        : expense.chargeDate && paymentOf(expense) !== 'direct'
          ? t('charged', { payment: tPayment(paymentOf(expense)), date: shortDate(expense.chargeDate) })
          : null;
    const part = !isPlan && expense.plan ? t('part', { part: expense.plan.part, parts: expense.plan.parts }) : null;
    // A restaurant card expense shows your part, and what the card paid when others pay back the rest; a shared one says
    // who paid instead
    const amountCents = isPlan ? planTotal(expenses) : countedCents(expense);
    const paid =
        !isPlan && !shared && amountCents !== expense.amountCents
            ? t('paid', { total: money(expense.amountCents, expense.currency) })
            : null;

    return (
        <span className="expense-item__body">
            <span className="expense-item__name">
                <CategoryBadge style={styleOf(expense.categoryId)} />
                <span className="expense-item__text">{name}</span>
            </span>
            <span className="expense-item__amount">{money(amountCents, expense.currency)}</span>
            {(showDate || expense.text || shared || pending || charged || part || paid) && (
                <span className="expense-item__meta">
                    {showDate && <span>{shortDate(expense.date)}</span>}
                    {expense.text && <span>{category}</span>}
                    {shared && <SharedRowDetails row={shared.row} group={shared.group} />}
                    {part && <span>{part}</span>}
                    {charged && <span>{charged}</span>}
                    {paid && <span>{paid}</span>}
                    {pending && <span className="expense-item__pending">{t('pending')}</span>}
                </span>
            )}
        </span>
    );
};

export { ExpenseItemBody, type ExpenseItemBodyProps };
