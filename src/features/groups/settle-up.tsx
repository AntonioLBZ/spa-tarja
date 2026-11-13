import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { useLocale } from '@/lib/i18n';
import { isCalendarDate, toDateString } from '@core/date';
import { groupDebts } from '@core/group-debts';
import { formatAmount, formatAmountInput, parseAmount } from '@core/money';
import { canonicalMember } from '@core/shared-member';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { newEntry } from './new-entry';
import { useEntryActions } from './use-entry-actions';
import { useGroupWords } from './use-group-words';

import type { Debt } from '@core/balance';
import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

import './settle-up.css';

type SettlementEntry = Extract<SharedEntry, { kind: 'settlement' }>;

// A settlement as the form holds it: who pays, who is paid, the amount as typed and the day
interface SettleDraft {
    from: string;
    to: string;
    amount: string;
    date: string;
}

type SettleForm = ReturnType<typeof useSettleUp>;

interface SettleUpProps {
    group: SharedGroup;
    // Apart from the settlement being edited, which the form is about to replace
    entries: readonly SharedEntry[];
    // The debts of `entries` as the group shows them
    debts: readonly Debt[];
    form: SettleForm;
    // Once the edit of a settlement is saved or cancelled, with its id, for its row to take the focus back
    onEditDone: (entryId: string) => void;
}

// What the first owes the second, negative when the second owes the first
const debtBetween = (debts: readonly Debt[], from: string, to: string): number => {
    const debt = debts.find((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from));
    if (!debt) return 0;
    return debt.from === from ? debt.cents : -debt.cents;
};

// A settlement: the member who pays is the payer, and the only share is the one who is paid
const settlementFields = (from: string, to: string, cents: number, date: string) => ({
    kind: 'settlement' as const,
    text: '',
    categoryId: null,
    amountCents: cents,
    date,
    paidBy: from,
    split: 'exact' as const,
    shares: [{ memberId: to, cents }],
    payment: 'direct' as const,
    chargeDate: null,
});

// From the person to whoever they owe most, else to the first other member who hasn't left, with the amount to type
const startDraft = (group: SharedGroup, debts: readonly Debt[]): SettleDraft => {
    const present = group.members.filter((member) => member.leftAt === null && member.id !== group.me);
    const owed = debts
        .filter((debt) => debt.from === group.me && present.some((member) => member.id === debt.to))
        .sort((a, b) => b.cents - a.cents);
    return {
        from: group.me,
        to: owed[0]?.to ?? present[0]?.id ?? group.me,
        amount: '',
        date: toDateString(new Date()),
    };
};

// The state of the form, kept above the balances so that a line can fill it in, or the ledger a settlement to edit. A
// draft of null is the start, which follows the balances until something in it is changed.
const useSettleUp = () => {
    const { locale } = useLocale();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<SettleDraft | null>(null);
    // The settlement the form changes; null while it records a new one
    const [editing, setEditing] = useState<SettlementEntry | null>(null);

    const take = useCallback(
        (debt: Debt) => {
            setDraft({
                from: debt.from,
                to: debt.to,
                amount: formatAmountInput(debt.cents, locale),
                date: toDateString(new Date()),
            });
            setOpen(true);
        },
        [locale]
    );

    // Back to recording a new one, from the start, closed
    const stopEditing = useCallback(() => {
        setEditing(null);
        setDraft(null);
        setOpen(false);
    }, []);

    return {
        open,
        setOpen,
        draft,
        setDraft,
        take,
        editing,
        // Fills the form with a settlement of the ledger, who paid and who was paid read as the members they are now
        edit: (entry: SettlementEntry, members: SharedGroup['members']) => {
            setEditing(entry);
            setDraft({
                from: canonicalMember(members, entry.paidBy),
                to: canonicalMember(members, entry.shares[0]!.memberId),
                amount: formatAmountInput(entry.amountCents, locale),
                date: entry.date,
            });
            setOpen(true);
        },
        // The settlement was deleted: an edit of it is over
        forget: (entryId: string) => {
            if (editing?.id === entryId) stopEditing();
        },
        stopEditing,
    };
};

// Records that one member paid another, through the outbox so that it works offline. It counts for nobody, only in the
// balances.
const SettleUp = (props: SettleUpProps) => {
    const { group, entries, debts, form, onEditDone } = props;
    const t = useTranslations('groups.settle');
    const { locale } = useLocale();
    const words = useGroupWords(group);
    const failureWords = useFailureWords();
    const { save } = useEntryActions();
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);
    const toggle = useRef<HTMLButtonElement>(null);
    // The sheet is closing and the button that opened it takes the focus, once the page is not inert any more
    const returnFocus = useRef(false);
    useEffect(() => {
        if (form.open || !returnFocus.current) return;
        returnFocus.current = false;
        toggle.current?.focus();
    }, [form.open]);
    const amountInput = useRef<HTMLInputElement>(null);
    const { editing } = form;

    const people = group.members.filter((member) => member.leftAt === null);
    if (people.length < 2) return null;

    const start = startDraft(group, debts);
    const kept = form.draft ?? start;
    // An end who left, or was merged, since it was chosen goes back to where the form starts
    const present = (memberId: string) => people.some((member) => member.id === memberId);
    const draft = {
        ...kept,
        from: present(kept.from) ? kept.from : start.from,
        to: present(kept.to) ? kept.to : start.to,
    };
    const { from, to } = draft;
    const change = (next: Partial<SettleDraft>) => form.setDraft({ ...draft, ...next });
    const options = people.map((member) => ({ value: member.id, label: words.nameInList(member.id) }));
    // Nothing when it isn't an amount
    const cents = parseAmount(draft.amount, locale) ?? 0;
    const same = from === to;
    const valid = cents >= 1 && !same && isCalendarDate(draft.date);

    // A debt in words, as one of "After this…"
    const afterDebt = (debtor: string, creditor: string, owed: number) => {
        const amount = formatAmount(owed, group.currency, locale);
        if (debtor === group.me) return t('after.youOwe', { name: words.nameOf(creditor), amount });
        if (creditor === group.me) return t('after.owesYou', { name: words.nameOf(debtor), amount });
        return t('after.owes', { from: words.nameOf(debtor), to: words.nameOf(creditor), amount });
    };

    // What the two would owe each other once this is saved, as the group would show it
    const after = (net: number) => {
        if (net > 0) return afterDebt(from, to, net);
        if (net < 0) return afterDebt(to, from, -net);
        if (from === group.me || to === group.me) {
            return t('after.youSettled', { name: words.nameOf(from === group.me ? to : from) });
        }
        return t('after.settled', { from: words.nameOf(from), to: words.nameOf(to) });
    };

    const before = debtBetween(debts, from, to);
    const fields = settlementFields(from, to, cents, draft.date);
    // The debts once this is saved, which a payment that is not the whole of a line can change for other lines
    const debtsAfter = () => groupDebts([...entries, newEntry(group, fields)], group.members, group.simplifyDebts);
    // Each a sentence of its own, so that they are never read as one
    const hint = [
        before > 0 && words.debt({ from, to, cents: before }),
        before < 0 && words.debt({ from: to, to: from, cents: -before }),
        cents >= 1 && !same && after(debtBetween(debtsAfter(), from, to)),
    ]
        .filter((text) => text !== false)
        .map((text) => t('sentence', { text }))
        .join(' ');

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy || !valid) return;

        setFailure(null);
        setBusy(true);
        try {
            // An edit keeps the id and the day it was made, and is later than the version it replaces (ADR-0005)
            await save(
                group.id,
                editing
                    ? {
                          ...fields,
                          id: editing.id,
                          currency: editing.currency,
                          createdAt: editing.createdAt,
                          updatedAt: Math.max(Date.now(), editing.updatedAt + 1),
                          deletedAt: null,
                      }
                    : newEntry(group, fields)
            );
            if (editing) {
                form.stopEditing();
                onEditDone(editing.id);
                return;
            }
            form.setDraft(null);
            form.setOpen(false);
            returnFocus.current = true;
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setBusy(false);
        }
    };

    // Closing the sheet keeps what was typed for a new settlement, and ends the edit of one, as Cancel does
    const handleClose = () => {
        if (!form.open) return;
        if (editing) {
            form.stopEditing();
            onEditDone(editing.id);
            return;
        }
        form.setOpen(false);
        returnFocus.current = true;
    };

    return (
        <>
            <Button block ref={toggle} aria-haspopup="dialog" onClick={() => form.setOpen(true)}>
                {t('title')}
            </Button>
            <Dialog
                open={form.open}
                variant="sheet"
                title={editing ? t('editTitle') : t('title')}
                closeLabel={t('close')}
                closeOnOutside={false}
                initialFocus={() => (editing ? null : amountInput.current)}
                onClose={handleClose}
            >
                <form className="settle-up" onSubmit={(event) => void handleSubmit(event)}>
                    <Field label={t('from')}>
                        {(control) => (
                            <Select
                                {...control}
                                options={options}
                                value={from}
                                onChange={(next) => change({ from: next })}
                            />
                        )}
                    </Field>
                    <Field label={t('to')} error={same ? t('same') : null}>
                        {(control) => (
                            <Select
                                {...control}
                                options={options}
                                value={to}
                                onChange={(next) => change({ to: next })}
                            />
                        )}
                    </Field>
                    <Field label={t('amount')} hint={hint || undefined}>
                        {(control) => (
                            <input
                                {...control}
                                ref={amountInput}
                                autoComplete="off"
                                inputMode="decimal"
                                required
                                type="text"
                                value={draft.amount}
                                onChange={(event) => change({ amount: event.target.value })}
                            />
                        )}
                    </Field>
                    <Field label={t('date')}>
                        {(control) => (
                            <input
                                {...control}
                                required
                                type="date"
                                value={draft.date}
                                onChange={(event) => change({ date: event.target.value })}
                            />
                        )}
                    </Field>
                    <div className="settle-up__actions">
                        <Button block variant="primary" disabled={!valid || busy} type="submit">
                            {t('save')}
                        </Button>
                        {editing && (
                            <Button
                                block
                                onClick={() => {
                                    form.stopEditing();
                                    onEditDone(editing.id);
                                }}
                            >
                                {t('cancel')}
                            </Button>
                        )}
                    </div>
                    {failure && (
                        <Notice tone="danger" role="alert">
                            {failureWords(failure)}
                        </Notice>
                    )}
                </form>
            </Dialog>
        </>
    );
};

export { SettleUp, useSettleUp, type SettleUpProps, type SettlementEntry };
