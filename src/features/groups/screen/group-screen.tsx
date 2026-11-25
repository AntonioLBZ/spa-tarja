import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { SentenceWithAmount } from '@/features/amounts/sentence-with-amount';
import { useExpenseSheet } from '@/features/expenses/sheet/expense-sheet-state';
import { GroupBalances } from '@/features/groups/balances/group-balances';
import { myBalance } from '@/features/groups/balances/my-balance';
import { SettleUp, useSettleUp } from '@/features/groups/balances/settle-up';
import { useGroupDebts } from '@/features/groups/balances/use-group-debts';
import { EntryRefusals } from '@/features/groups/data/entry-refusals';
import { GroupLedger } from '@/features/groups/ledger/group-ledger';
import { useGroupWords } from '@/features/groups/words/use-group-words';
import { PushSuggestion } from '@/features/notifications/push-suggestion';
import { useAmount } from '@/lib/amounts';

import { GroupGate } from './group-gate';

import type { Ledger } from '@/features/groups/data/use-ledgers';

import './group-screen.css';

interface GroupScreenProps {
    groupId: string;
    // Shown under its tab on the Expenses screen, which says its name (ADR-0021)
    inTab?: boolean;
}

interface GroupViewProps {
    ledger: Ledger;
    inTab?: boolean;
}

// A group or a friend: what the person is owed or owes, who owes whom and settling up, its entries, and the way to its
// settings. Adding an expense is the "+", and Edit and Duplicate of an entry open the same sheet.
const GroupScreen = (props: GroupScreenProps) => {
    const { groupId, inTab } = props;

    return <GroupGate groupId={groupId}>{(ledger) => <GroupView ledger={ledger} inTab={inTab} />}</GroupGate>;
};

const GroupView = (props: GroupViewProps) => {
    const { ledger, inTab } = props;
    const { group, entries, hasData, isError, isWaitingForNetwork } = ledger;
    const t = useTranslations('groups');
    const words = useGroupWords(group);
    const settle = useSettleUp();
    const sheet = useExpenseSheet();
    const { debts, formEntries, formDebts } = useGroupDebts(group, entries, settle.editing?.id ?? null);
    const open = group.closed === null;
    const titleClsx = clsx('group-screen__title', { 'visually-hidden': inTab });
    const amount = useAmount();
    const balance = myBalance(group, entries);
    const editClsx = clsx('group-screen__edit', { 'group-screen__edit--foot': inTab });
    const editLink = (
        <ButtonLink ghost className={editClsx} to="/groups/$groupId/edit" params={{ groupId: group.id }}>
            {group.kind === 'direct' ? t('edit.linkFriend') : t('edit.link')}
        </ButtonLink>
    );

    return (
        <section className="group-screen">
            {/* Under a tab the tabs are the title, so the link goes to the foot instead of a row of its own */}
            {inTab ? (
                <ScreenTitle className={titleClsx}>{words.title}</ScreenTitle>
            ) : (
                <div className="group-screen__head">
                    <ScreenTitle className={titleClsx}>{words.title}</ScreenTitle>
                    {editLink}
                </div>
            )}
            <EntryRefusals groupId={group.id} />
            <PushSuggestion group={group} />
            {hasData && (
                <>
                    <Notice role="status">
                        <SentenceWithAmount
                            sentence={(text) => words.mine(balance, text)}
                            amount={{ ...amount(balance, group.currency, { cues: true }), sign: false }}
                        />
                    </Notice>
                    <GroupBalances
                        group={group}
                        entries={entries}
                        debts={debts}
                        onSettle={open ? settle.take : undefined}
                        action={
                            open && (
                                <SettleUp
                                    group={group}
                                    entries={formEntries}
                                    debts={formDebts}
                                    form={settle}
                                    onEditDone={sheet.requestRefocus}
                                />
                            )
                        }
                    />
                </>
            )}
            <LiveNotice tone="danger">
                {!hasData && (isError || isWaitingForNetwork) && t('group.entriesFailed')}
            </LiveNotice>
            {words.closed && <Notice tone="quiet">{t(`group.closed.${words.closed}`)}</Notice>}
            {hasData && (
                <GroupLedger
                    key={group.id}
                    ledger={ledger}
                    onEdit={(entry) => sheet.startEditEntry({ group, entry })}
                    onEditSettlement={(entry) => settle.edit(entry, group.members)}
                    onDuplicate={(entry) => sheet.startCopyEntry({ group, entry })}
                    onDeleted={(entryId) => {
                        sheet.forget(entryId);
                        settle.forget(entryId);
                    }}
                    refocus={sheet.refocus}
                    onRefocused={sheet.clearRefocus}
                />
            )}
            {inTab && editLink}
        </section>
    );
};

export { GroupScreen, type GroupScreenProps };
