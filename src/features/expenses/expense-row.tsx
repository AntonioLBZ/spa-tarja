import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { paymentOf } from '@core/counting';
import { planTotal } from '@core/installments';
import { formatAmount } from '@core/money';

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
    onDelete: (expenses: readonly Expense[]) => void;
}

// An expense of the list. Pressing it opens a panel under it with what can be done to it.
function ExpenseRow(props: ExpenseRowProps) {
    const { expenses, isPlan, pending, leaving, onDelete } = props;
    const t = useTranslations('expenses.list');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
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

    return (
        <Disclosure
            as="li"
            className={clsx('expense-item', leaving && 'expense-item--leaving')}
            chevron
            summary={
                <span className="expense-item__body">
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
                </span>
            }
        >
            <div className="expense-item__actions">
                <Button
                    variant="danger"
                    aria-label={t('deleteItem', { name })}
                    disabled={leaving}
                    onClick={() => onDelete(expenses)}
                >
                    {t('delete')}
                </Button>
            </div>
        </Disclosure>
    );
}

export { ExpenseRow };
