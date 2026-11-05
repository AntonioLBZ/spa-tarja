import { useId, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { useGroupOutbox, type PendingEntry, type Rejection } from '@/lib/offline';

import { useEntryWords } from './use-entry-words';
import { useGroups } from './use-ledgers';

import type { SharedGroup } from '@core/shared-group';

import './entry-refusals.css';

interface EntryRefusalsProps {
    // Only those of this group; every one without it
    groupId?: string;
}

interface RefusalProps {
    rejection: Rejection<PendingEntry>;
    group: SharedGroup | undefined;
}

interface GroupRefusalProps {
    rejection: Rejection<PendingEntry>;
    group: SharedGroup;
}

interface RefusalNoticeProps {
    rejection: Rejection<PendingEntry>;
    message: string;
}

// The words of each reason a group gives for refusing an entry for good; any other is "the server refused it"
const REASONS = {
    closed: 'closed',
    'member-left': 'memberLeft',
    'unknown-member': 'unknownMember',
    'not-the-payer': 'notThePayer',
    'kind-fixed': 'kindFixed',
    'currency-mismatch': 'currencyMismatch',
    'unknown-category': 'unknownCategory',
    'id-taken': 'idTaken',
    'clock-ahead': 'clockAhead',
} as const;

const reasonOf = (code: string | null) => {
    return (code !== null && REASONS[code as keyof typeof REASONS]) || 'other';
};

// The writes to groups the server refused for good, each said in words with its own Dismiss. They live in memory, like
// those of the expenses, so a reload forgets them.
const EntryRefusals = (props: EntryRefusalsProps) => {
    const { groupId } = props;
    const outbox = useGroupOutbox();
    const { rejected } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const { groups } = useGroups();
    const shown = groupId === undefined ? rejected : rejected.filter((item) => item.item.groupId === groupId);

    if (shown.length === 0) return null;

    return (
        <div className="entry-refusals">
            {shown.map((rejection) => (
                <Refusal
                    key={`${rejection.item.id} ${rejection.item.updatedAt}`}
                    rejection={rejection}
                    group={groups.find((group) => group.id === rejection.item.groupId)}
                />
            ))}
        </div>
    );
};

const Refusal = (props: RefusalProps) => {
    const { rejection, group } = props;
    const t = useTranslations('groups.refused');

    if (group) return <GroupRefusal rejection={rejection} group={group} />;
    return (
        <RefusalNotice rejection={rejection} message={`${t('elsewhere')} ${t(`reason.${reasonOf(rejection.code)}`)}`} />
    );
};

const GroupRefusal = (props: GroupRefusalProps) => {
    const { rejection, group } = props;
    const t = useTranslations('groups.refused');
    const words = useEntryWords(group);
    const change = t('change', { name: words.nameOf(rejection.item), group: words.title });

    return <RefusalNotice rejection={rejection} message={`${change} ${t(`reason.${reasonOf(rejection.code)}`)}`} />;
};

const RefusalNotice = (props: RefusalNoticeProps) => {
    const { rejection, message } = props;
    const t = useTranslations('groups.refused');
    const outbox = useGroupOutbox();
    const id = useId();

    return (
        <div className="entry-refusals__item">
            <Notice tone="danger" role="alert" id={id} className="entry-refusals__message">
                {message}
            </Notice>
            <Button aria-describedby={id} onClick={() => outbox.dismissRejection(rejection)}>
                {t('dismiss')}
            </Button>
        </div>
    );
};

export { EntryRefusals, type EntryRefusalsProps };
