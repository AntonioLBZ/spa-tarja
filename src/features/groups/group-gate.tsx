import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { Notice } from '@/components/notice/notice';

import { useGroups, useLedgers, type Ledger } from './use-ledgers';

import type { ReactNode } from 'react';

import './group-gate.css';

interface GroupGateProps {
    groupId: string;
    // The screen of the group, once the device holds it
    children: (ledger: Ledger) => ReactNode;
}

// A screen of one group from the copy on the device; a group it doesn't hold, or the groups never heard of, say so
// with a way back to Groups
const GroupGate = (props: GroupGateProps) => {
    const { groupId, children } = props;
    const t = useTranslations('groups.group');
    const { hasData, isError, isWaitingForNetwork } = useGroups();
    const { ledgers } = useLedgers();
    // Ids are read in lower case wherever they are compared
    const ledger = ledgers.find((item) => item.group.id === groupId.toLowerCase());

    if (ledger) return children(ledger);
    if (!hasData && !isError && !isWaitingForNetwork) return null;

    return (
        <section className="group-gate">
            <Notice>{hasData ? t('missing') : t('loadFailed')}</Notice>
            <ButtonLink block to="/groups">
                {t('back')}
            </ButtonLink>
        </section>
    );
};

export { GroupGate, type GroupGateProps };
