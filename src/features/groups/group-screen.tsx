import { useEffect, useRef } from 'react';
import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { ExpenseForm } from '@/features/expenses/expense-form';
import { readDuration } from '@/lib/motion';

import { EntryRefusals } from './entry-refusals';
import { GroupBalances } from './group-balances';
import { GroupGate } from './group-gate';
import { GroupLedger } from './group-ledger';
import { myBalance } from './my-balance';
import { SettleUp, useSettleUp } from './settle-up';
import { useGroupWords } from './use-group-words';
import { useLedgerForm } from './use-ledger-form';

import type { Ledger } from './use-ledgers';

import './group-screen.css';

interface GroupScreenProps {
    groupId: string;
}

interface GroupViewProps {
    ledger: Ledger;
}

// A group or a friend: what the person is owed or owes, who owes whom and settling up, adding an expense, its entries,
// and the way to its settings
const GroupScreen = (props: GroupScreenProps) => {
    const { groupId } = props;

    return <GroupGate groupId={groupId}>{(ledger) => <GroupView ledger={ledger} />}</GroupGate>;
};

const GroupView = (props: GroupViewProps) => {
    const { ledger } = props;
    const { group, entries, hasData, isError, isWaitingForNetwork } = ledger;
    const t = useTranslations('groups');
    const tForm = useTranslations('expenses.form');
    const words = useGroupWords(group);
    const settle = useSettleUp();
    const form = useLedgerForm();
    const { editing, copying } = form;
    const heading = useRef<HTMLButtonElement>(null);
    const open = group.closed === null;
    const formTitle = editing ? tForm('editTitle') : copying ? tForm('copyTitle') : tForm('title');

    // Edit and Duplicate bring the form into view and put the focus on its heading, never on a field: a phone would
    // open its keyboard
    useEffect(() => {
        if (!editing && !copying) return;
        const behavior = readDuration('--duration-base') === 0 ? 'instant' : 'smooth';
        heading.current?.scrollIntoView({ behavior, block: 'start' });
        heading.current?.focus({ preventScroll: true });
    }, [editing, copying]);

    return (
        <section className="group-screen">
            <h1 className="group-screen__title">{words.title}</h1>
            <EntryRefusals groupId={group.id} />
            {hasData && (
                <>
                    <Notice role="status">{words.mine(myBalance(group, entries))}</Notice>
                    <GroupBalances group={group} entries={entries} onSettle={open ? settle.take : undefined} />
                    {open && <SettleUp group={group} entries={entries} form={settle} onEditDone={form.setRefocus} />}
                </>
            )}
            {/* Writing an expense needs no ledger on the device: it goes through the outbox */}
            {open && (
                <Disclosure
                    as="section"
                    heading="h2"
                    summary={formTitle}
                    chevron
                    keepMounted
                    open={form.open}
                    onOpenChange={form.setOpen}
                    toggleRef={heading}
                >
                    <ExpenseForm
                        key={form.key}
                        title={formTitle}
                        group={group}
                        editingEntry={editing}
                        copyingEntry={copying}
                        onDone={form.end}
                    />
                </Disclosure>
            )}
            {!hasData && (isError || isWaitingForNetwork) && <Notice tone="danger">{t('group.entriesFailed')}</Notice>}
            {words.closed && <Notice tone="quiet">{t(`group.closed.${words.closed}`)}</Notice>}
            {hasData && (
                <GroupLedger
                    ledger={ledger}
                    onEdit={form.startEdit}
                    onEditSettlement={(entry) => settle.edit(entry, group.members)}
                    onDuplicate={form.startCopy}
                    onDeleted={(entryId) => {
                        form.forget(entryId);
                        settle.forget(entryId);
                    }}
                    refocus={form.refocus}
                    onRefocused={() => form.setRefocus(null)}
                />
            )}
            <ButtonLink ghost className="group-screen__edit" to="/groups/$groupId/edit" params={{ groupId: group.id }}>
                {group.kind === 'direct' ? t('edit.linkFriend') : t('edit.link')}
            </ButtonLink>
        </section>
    );
};

export { GroupScreen, type GroupScreenProps };
