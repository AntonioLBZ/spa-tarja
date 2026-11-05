import clsx from 'clsx';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { formatAmount } from '@core/money';
import { yourPart, type SharedExpenseEntry } from '@core/shared-expense';

import { namesSomeoneWhoLeft } from './names-someone-who-left';
import { useEntryWords } from './use-entry-words';

import type { LedgerEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';
import type { RefCallback } from 'react';

import '@/features/expenses/expense-row.css';
import './ledger-row.css';

interface LedgerRowProps {
    group: SharedGroup;
    entry: LedgerEntry;
    // Not on the server yet
    pending: boolean;
    // Deleted a moment ago, fading out
    leaving: boolean;
    // Without them, as in a closed group, the row has nothing to open
    onEdit?: (entry: LedgerEntry) => void;
    onDuplicate?: (entry: SharedExpenseEntry) => void;
    onDelete?: (entry: LedgerEntry) => void;
    // What takes the focus when the row is to have it: its toggle, or the row when it has nothing to open
    focusRef?: RefCallback<HTMLElement>;
}

// An entry of the ledger as a line of the ticket: an expense by its name with its total, who paid and your part, or a
// settlement in words, and who wrote it last when it wasn't the person. Pressing it opens what can be done to it.
const LedgerRow = (props: LedgerRowProps) => {
    const { group, entry, pending, leaving, onEdit, onDuplicate, onDelete, focusRef } = props;
    const t = useTranslations('groups');
    const tList = useTranslations('expenses.list');
    const { locale } = useLocale();
    const { styleOf } = useCategoryOptions();
    const words = useEntryWords(group);
    const reasonId = useId();
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

    const name = words.entryName(entry);
    const body = (
        <span className="expense-item__body">
            <span className="expense-item__name">
                {entry.kind === 'expense' && <CategoryBadge style={styleOf(entry.categoryId)} />}
                <span className="expense-item__text">{name}</span>
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
    );
    const rowClsx = clsx('expense-item', { 'expense-item--leaving': leaving });
    const blocked = namesSomeoneWhoLeft(entry, group);

    if (!onDelete) {
        return (
            <li ref={focusRef} className="expense-item ledger-row" tabIndex={-1}>
                {body}
            </li>
        );
    }

    return (
        <Disclosure as="li" className={rowClsx} chevron toggleRef={focusRef} summary={body}>
            <div className="expense-item__actions">
                {onEdit && (
                    <Button
                        ghost
                        aria-describedby={blocked ? reasonId : undefined}
                        aria-label={tList('editItem', { name })}
                        disabled={leaving || blocked}
                        onClick={() => onEdit(entry)}
                    >
                        {tList('edit')}
                    </Button>
                )}
                {entry.kind === 'expense' && onDuplicate && (
                    <Button
                        ghost
                        aria-label={tList('duplicateItem', { name })}
                        disabled={leaving}
                        onClick={() => onDuplicate(entry)}
                    >
                        {tList('duplicate')}
                    </Button>
                )}
                <Button
                    ghost
                    variant="danger"
                    aria-label={tList('deleteItem', { name })}
                    disabled={leaving}
                    onClick={() => onDelete(entry)}
                >
                    {tList('delete')}
                </Button>
            </div>
            {blocked && (
                <Notice tone="quiet" id={reasonId}>
                    {t('ledger.leftCantEdit')}
                </Notice>
            )}
        </Disclosure>
    );
};

export { LedgerRow, type LedgerRowProps };
