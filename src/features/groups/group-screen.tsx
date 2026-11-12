import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { Notice } from '@/components/notice/notice';
import { useExpenseSheet } from '@/features/expenses/expense-sheet-state';
import { HeroStat } from '@/features/shell/hero-stat';
import { Page } from '@/features/shell/page';

import { EntryRefusals } from './entry-refusals';
import { GroupBalances } from './group-balances';
import { GroupGate } from './group-gate';
import { GroupLedger } from './group-ledger';
import { myBalance } from './my-balance';
import { SettleUp, useSettleUp } from './settle-up';
import { useGroupDebts } from './use-group-debts';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';

import './group-screen.css';

interface GroupScreenProps {
    groupId: string;
}

interface GroupViewProps {
    ledger: Ledger;
}

// A group or a friend: what the person is owed or owes, who owes whom and settling up, its entries, and the way to its
// settings. Adding an expense is the "+", and Edit and Duplicate of an entry open the same sheet.
const GroupScreen = (props: GroupScreenProps) => {
    const { groupId } = props;

    return <GroupGate groupId={groupId}>{(ledger) => <GroupView ledger={ledger} />}</GroupGate>;
};

const GroupView = (props: GroupViewProps) => {
    const { ledger } = props;
    const { group, entries, hasData, isError, isWaitingForNetwork } = ledger;
    const t = useTranslations('groups');
    const words = useGroupWords(group);
    const settle = useSettleUp();
    const sheet = useExpenseSheet();
    const { debts, formEntries, formDebts } = useGroupDebts(group, entries, settle.editing?.id ?? null);
    const open = group.closed === null;

    return (
        <Page
            title={words.title}
            hero={
                hasData ? (
                    <HeroStat text={<span role="status">{words.mine(myBalance(group, entries))}</span>} size="title" />
                ) : undefined
            }
        >
            <div className="group-screen">
                <EntryRefusals groupId={group.id} />
                {hasData && (
                    <>
                        <GroupBalances
                            group={group}
                            entries={entries}
                            debts={debts}
                            onSettle={open ? settle.take : undefined}
                        />
                        {open && (
                            <SettleUp
                                group={group}
                                entries={formEntries}
                                debts={formDebts}
                                form={settle}
                                onEditDone={sheet.requestRefocus}
                            />
                        )}
                    </>
                )}
                {!hasData && (isError || isWaitingForNetwork) && (
                    <Notice role="status" tone="danger">
                        {t('group.entriesFailed')}
                    </Notice>
                )}
                {words.closed && <Notice tone="quiet">{t(`group.closed.${words.closed}`)}</Notice>}
                {hasData && (
                    <GroupLedger
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
                <ButtonLink
                    ghost
                    className="group-screen__edit"
                    to="/groups/$groupId/edit"
                    params={{ groupId: group.id }}
                >
                    {group.kind === 'direct' ? t('edit.linkFriend') : t('edit.link')}
                </ButtonLink>
            </div>
        </Page>
    );
};

export { GroupScreen, type GroupScreenProps };
