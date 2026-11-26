import clsx from 'clsx';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Amount } from '@/components/amount/amount';
import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Icon } from '@/components/icon/icon';
import { Notice } from '@/components/notice/notice';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { namesSomeoneWhoLeft } from '@/features/groups/words/names-someone-who-left';
import { useEntryWords } from '@/features/groups/words/use-entry-words';
import { useAmount, useMoney } from '@/lib/amounts';

import { ledgerEffect } from './ledger-effect';

import type { LedgerEntry } from '@core/groups/shared-entry';
import type { SharedExpenseEntry } from '@core/groups/shared-expense';
import type { SharedGroup } from '@core/groups/shared-group';
import type { RefCallback } from 'react';

import '@/features/expenses/list/expense-row.css';
import './ledger-row.css';

interface LedgerRowProps {
    group: SharedGroup;
    entry: LedgerEntry;
    /** Not on the server yet */
    pending: boolean;
    /** Deleted a moment ago, fading out */
    leaving: boolean;
    /** The day it was made, said first in the details, for a ledger that isn't by day */
    date?: string;
    /** Without them, as in a closed group, the row has nothing to open */
    onEdit?: (entry: LedgerEntry) => void;
    onDuplicate?: (entry: SharedExpenseEntry) => void;
    onDelete?: (entry: LedgerEntry) => void;
    /** What takes the focus when the row is to have it: its toggle, or the row when it has nothing to open */
    focusRef?: RefCallback<HTMLElement>;
}

// An entry of the ledger as a line of the ticket, as an expense of the person's list is: its name, what it does to their
// balance in the group with its cues, and under them who paid the whole, or that it is theirs alone or not theirs, and
// pressing it opens who paid and each share, who wrote it last when it wasn't the person, and what can be done
// to it (ADR-0030).
const LedgerRow = (props: LedgerRowProps) => {
    const { group, entry, pending, leaving, date, onEdit, onDuplicate, onDelete, focusRef } = props;
    const t = useTranslations('groups');
    const tList = useTranslations('expenses.list');
    const { styleOf } = useCategoryOptions();
    const words = useEntryWords(group);
    const reasonId = useId();
    const format = useMoney();
    const amount = useAmount();
    const money = (cents: number) => format(cents, entry.currency);

    const writer = entry.updatedBy === null ? t('names.deleted') : words.nameOf(entry.updatedBy);
    const wrote =
        entry.updatedBy === group.me
            ? null
            : t(entry.updatedAt === entry.createdAt ? 'ledger.addedBy' : 'ledger.editedBy', { name: writer });
    const { paidByMe, part, cents, touch } = ledgerEffect(entry, group);
    const payer = words.nameOf(entry.paidBy);
    const total = money(entry.amountCents);
    const name = words.entryName(entry);
    const settlement = entry.kind === 'settlement';
    // Paying a debt back is not earning: a settlement always shows its whole amount, neutral, with no color and no
    // sign, whether it is the person's or not
    const effect = settlement ? { text: total } : amount(cents, entry.currency, { cues: true });
    const shown = settlement || touch === 'moves';

    // Who paid the whole, which a settlement already says in its name; a settlement counts for nobody, so it says
    // nothing of the person either
    const paid = settlement
        ? null
        : paidByMe
          ? t('ledger.youPaidTotal', { total })
          : t('ledger.paidTotal', { name: payer, total });
    const quiet = settlement || touch === 'moves' ? null : t(`ledger.${touch}`);

    const sentence = (() => {
        if (entry.kind === 'settlement') return t('ledger.spoken.settlement', { name, total });
        if (touch === 'notIn') return t('ledger.spoken.notIn', { name, payer, total });
        if (touch === 'justYou') return t('ledger.spoken.justYou', { name, total });
        if (paidByMe) return t('ledger.spoken.lent', { name, total, amount: money(cents) });
        return t('ledger.spoken.borrowed', { name, payer, total, amount: money(part) });
    })();

    const body = (
        <span className="expense-item__body">
            <span className="visually-hidden">{sentence}</span>
            <span className="expense-item__name" aria-hidden="true">
                {entry.kind === 'expense' ? (
                    <CategoryBadge style={styleOf(entry.categoryId)} />
                ) : (
                    <span className="ledger-row__mark">
                        <Icon name="payments" />
                    </span>
                )}
                <span className="expense-item__text">{name}</span>
            </span>
            {shown && (
                <span className="expense-item__amount" aria-hidden="true">
                    <Amount {...effect} />
                </span>
            )}
            {(date || paid || quiet || pending) && (
                <span className="expense-item__meta">
                    {date && <span>{date}</span>}
                    {paid && <span aria-hidden="true">{paid}</span>}
                    {quiet && <span aria-hidden="true">{quiet}</span>}
                    {pending && <span className="expense-item__pending">{tList('pending')}</span>}
                </span>
            )}
        </span>
    );
    const rowClsx = clsx('expense-item', { 'expense-item--leaving': leaving, 'ledger-row--settlement': settlement });
    const blocked = namesSomeoneWhoLeft(entry, group);

    if (!onDelete && entry.kind === 'settlement') {
        return (
            <li ref={focusRef} className="expense-item ledger-row--still ledger-row--settlement" tabIndex={-1}>
                {body}
            </li>
        );
    }

    return (
        <Disclosure as="li" className={rowClsx} chevron align="top" toggleRef={focusRef} summary={body}>
            {entry.kind === 'expense' && (
                <ul className="ledger-row__breakdown" aria-label={t('ledger.breakdown')} role="list">
                    <li className="ledger-row__share">
                        <span className="ledger-row__who">
                            {paidByMe ? t('ledger.youPaid') : t('ledger.paidBy', { name: payer })}
                        </span>
                        <span>{total}</span>
                    </li>
                    {entry.shares.map((share) => (
                        <li className="ledger-row__share" key={share.memberId}>
                            <span className="ledger-row__who">{words.nameInList(share.memberId)}</span>
                            <span>{money(share.cents)}</span>
                        </li>
                    ))}
                </ul>
            )}
            {wrote && <p className="hint ledger-row__wrote">{wrote}</p>}
            {onDelete && (
                <Actions>
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
                </Actions>
            )}
            {onDelete && blocked && (
                <Notice tone="quiet" id={reasonId}>
                    {t('ledger.leftCantEdit')}
                </Notice>
            )}
        </Disclosure>
    );
};

export { LedgerRow, type LedgerRowProps };
