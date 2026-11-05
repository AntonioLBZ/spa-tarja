import { useTranslations } from 'use-intl';

import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { formatAmount } from '@core/money';
import { yourPart } from '@core/shared-expense';

import { useEntryWords } from './use-entry-words';

import type { LedgerEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';
import type { Ref } from 'react';

import '@/features/expenses/expense-row.css';
import './ledger-row.css';

interface LedgerRowProps {
    group: SharedGroup;
    entry: LedgerEntry;
    // Not on the server yet
    pending: boolean;
    // Takes the focus when "Show more" brings it in
    rowRef?: Ref<HTMLLIElement>;
}

// An entry of the ledger as a line of the ticket: an expense by its name with its total, who paid and your part, or a
// settlement in words, and who wrote it last when it wasn't the person
const LedgerRow = (props: LedgerRowProps) => {
    const { group, entry, pending, rowRef } = props;
    const t = useTranslations('groups');
    const tList = useTranslations('expenses.list');
    const { locale } = useLocale();
    const { styleOf } = useCategoryOptions();
    const words = useEntryWords(group);
    const money = (cents: number) => formatAmount(cents, entry.currency, locale);

    const writer = entry.updatedBy === null ? t('names.deleted') : words.nameOf(entry.updatedBy);
    const wrote =
        entry.updatedBy === group.me
            ? null
            : t(entry.updatedAt === entry.createdAt ? 'ledger.addedBy' : 'ledger.editedBy', { name: writer });
    const part = yourPart(entry, group.me, group.members);
    const details =
        entry.kind === 'expense'
            ? [
                  words.isMe(entry.paidBy)
                      ? t('ledger.youPaid')
                      : t('ledger.paidBy', { name: words.nameOf(entry.paidBy) }),
                  part > 0 ? t('ledger.yourPart', { amount: money(part) }) : t('ledger.notIn'),
              ]
            : [];

    return (
        <li ref={rowRef} className="expense-item ledger-row" tabIndex={-1}>
            <span className="expense-item__body">
                <span className="expense-item__name">
                    {entry.kind === 'expense' && <CategoryBadge style={styleOf(entry.categoryId)} />}
                    <span className="expense-item__text">{words.entryName(entry)}</span>
                </span>
                <span className="expense-item__amount">{money(entry.amountCents)}</span>
                {(details.length > 0 || wrote || pending) && (
                    <span className="expense-item__meta">
                        {details.map((detail) => (
                            <span key={detail}>{detail}</span>
                        ))}
                        {wrote && <span>{wrote}</span>}
                        {pending && <span className="expense-item__pending">{tList('pending')}</span>}
                    </span>
                )}
            </span>
        </li>
    );
};

export { LedgerRow, type LedgerRowProps };
