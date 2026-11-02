import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { Notice } from '@/components/notice/notice';

import { GroupBalances } from './group-balances';
import { GroupGate } from './group-gate';
import { myBalance } from './my-balance';
import { SettleUp, useSettleUp } from './settle-up';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';

import './group-screen.css';

interface GroupScreenProps {
    groupId: string;
}

interface GroupViewProps {
    ledger: Ledger;
}

// A group or a friend: what the person is owed or owes, who owes whom and settling up, and the way to its settings
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
    const open = group.closed === null;

    return (
        <section className="group-screen">
            <h1 className="group-screen__title">{words.title}</h1>
            {hasData && (
                <>
                    <Notice role="status">{words.mine(myBalance(group, entries))}</Notice>
                    <GroupBalances group={group} entries={entries} onSettle={open ? settle.take : undefined} />
                    {open && <SettleUp group={group} entries={entries} form={settle} />}
                </>
            )}
            {!hasData && (isError || isWaitingForNetwork) && <Notice tone="danger">{t('group.entriesFailed')}</Notice>}
            {words.closed && <Notice tone="quiet">{t(`group.closed.${words.closed}`)}</Notice>}
            <ButtonLink ghost className="group-screen__edit" to="/groups/$groupId/edit" params={{ groupId: group.id }}>
                {group.kind === 'direct' ? t('edit.linkFriend') : t('edit.link')}
            </ButtonLink>
        </section>
    );
};

export { GroupScreen, type GroupScreenProps };
