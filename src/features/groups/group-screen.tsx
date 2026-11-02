import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { Notice } from '@/components/notice/notice';

import { GroupBalances } from './group-balances';
import { myBalance } from './my-balance';
import { useGroupWords } from './use-group-words';
import { useGroups, useLedgers, type Ledger } from './use-ledgers';

import './group-screen.css';

interface GroupScreenProps {
    groupId: string;
}

interface GroupViewProps {
    ledger: Ledger;
}

// A group or a friend, from the copy on the device: what the person is owed or owes, and who owes whom
const GroupScreen = (props: GroupScreenProps) => {
    const { groupId } = props;
    const t = useTranslations('groups.group');
    const { hasData, isError, isWaitingForNetwork } = useGroups();
    const { ledgers } = useLedgers();
    // Ids are read in lower case wherever they are compared
    const ledger = ledgers.find((item) => item.group.id === groupId.toLowerCase());

    if (ledger) return <GroupView ledger={ledger} />;
    if (!hasData && !isError && !isWaitingForNetwork) return null;

    return (
        <section className="group-screen">
            <Notice>{hasData ? t('missing') : t('loadFailed')}</Notice>
            <ButtonLink block to="/groups">
                {t('back')}
            </ButtonLink>
        </section>
    );
};

const GroupView = (props: GroupViewProps) => {
    const { ledger } = props;
    const { group, entries, hasData, isError, isWaitingForNetwork } = ledger;
    const t = useTranslations('groups.group');
    const words = useGroupWords(group);

    return (
        <section className="group-screen">
            <h1 className="group-screen__title">{words.title}</h1>
            {hasData && (
                <>
                    <Notice>{words.mine(myBalance(group, entries))}</Notice>
                    <GroupBalances group={group} entries={entries} />
                </>
            )}
            {!hasData && (isError || isWaitingForNetwork) && <Notice tone="danger">{t('entriesFailed')}</Notice>}
            {words.closed && <Notice tone="quiet">{t(`closed.${words.closed}`)}</Notice>}
        </section>
    );
};

export { GroupScreen, type GroupScreenProps };
