import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { GROUPS_KEY, PENDING_INVITATIONS_KEY } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';
import { MAX_PINNED_GROUPS } from '@core/shared-group';

import { EntryRefusals } from './entry-refusals';
import { useFailureWords } from './group-failure';
import { GroupList, GroupSheet } from './group-list';
import { InviteFriend } from './invite-friend';
import { myBalance } from './my-balance';
import { NewGroup } from './new-group';
import { useGroups, useLedgers, type Ledger } from './use-ledgers';
import { usePins } from './use-pins';

import './groups.css';

interface GroupTotalsProps {
    ledgers: readonly Ledger[];
}

interface ListSectionProps {
    title: string;
    children: ReactNode;
}

// The Groups tab: what the person is owed and owes across their open groups and friends; the groups, with making one,
// and the friends, with inviting one by a link; and at the end the closed and the archived ones
const Groups = () => {
    const t = useTranslations('groups');
    const online = useOnline();
    const client = useQueryClient();
    const { hasData, isError, isWaitingForNetwork } = useGroups();
    const { ledgers } = useLedgers();
    const pins = usePins();
    const failureWords = useFailureWords();

    // Opening the tab reads the groups and the links again, so a link accepted meanwhile is a friend and not a link
    useEffect(() => {
        for (const queryKey of [GROUPS_KEY, PENDING_INVITATIONS_KEY]) {
            void client.invalidateQueries({ queryKey }, { cancelRefetch: false });
        }
    }, [client]);

    const open = ledgers.filter((ledger) => ledger.group.closed === null);
    const groups = open.filter((ledger) => ledger.group.kind === 'group');
    const friends = open.filter((ledger) => ledger.group.kind === 'direct');
    const closed = ledgers.filter((ledger) => ledger.group.closed !== null && !ledger.group.archived);
    const archived = ledgers.filter((ledger) => ledger.group.closed !== null && ledger.group.archived);

    return (
        <section className="groups">
            <h1 className="groups__title">{t('title')}</h1>
            {!online && <Notice role="status">{t('offline')}</Notice>}
            <EntryRefusals />
            {!hasData && (isError || isWaitingForNetwork) && (
                <Notice role="status" tone="danger">
                    {t('group.loadFailed')}
                </Notice>
            )}
            {hasData &&
                (open.length > 0 ? (
                    <GroupTotals ledgers={open} />
                ) : (
                    <Notice tone="quiet">
                        <span className="groups__empty-line">{t('empty')}</span>
                        <span className="groups__empty-line">{t('emptyHint')}</span>
                    </Notice>
                ))}
            {pins.full && <p className="groups__pin-full">{t('edit.pinFull', { max: MAX_PINNED_GROUPS })}</p>}
            {pins.failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(pins.failure)}
                </Notice>
            )}
            <ListSection title={t('lists.groups')}>
                <NewGroup disabled={!online} />
                {groups.length > 0 && <GroupList ledgers={groups} pins={pins} />}
            </ListSection>
            <ListSection title={t('lists.friends')}>
                <InviteFriend disabled={!online} />
                {friends.length > 0 && <GroupList ledgers={friends} pins={pins} />}
                {hasData && open.length > 0 && friends.length === 0 && (
                    <Notice tone="quiet">{t('lists.friendsNone')}</Notice>
                )}
            </ListSection>
            {closed.length > 0 && (
                <Disclosure summary={t('lists.closed')} chevron>
                    <GroupSheet label={t('lists.closed')} ledgers={closed} />
                </Disclosure>
            )}
            {archived.length > 0 && (
                <Disclosure summary={t('lists.archived')} chevron>
                    <GroupSheet label={t('lists.archived')} ledgers={archived} />
                </Disclosure>
            )}
        </section>
    );
};

// A list with its own heading, its control first and then the rows
const ListSection = (props: ListSectionProps) => {
    const { title, children } = props;
    const headingId = useId();

    return (
        <section className="groups__section" aria-labelledby={headingId}>
            <h2 className="groups__heading" id={headingId}>
                {title}
            </h2>
            {children}
        </section>
    );
};

// Each total adds the groups where the person's balance has that sign; a group has the app's currency (ADR-0012).
// They wait while a group's expenses haven't reached the device, as the sums would leave it out, and say why once
// those expenses can't be loaded.
const GroupTotals = (props: GroupTotalsProps) => {
    const { ledgers } = props;
    const t = useTranslations('groups');
    const { locale } = useLocale();

    const missing = ledgers.filter((ledger) => !ledger.hasData);
    if (missing.some((ledger) => ledger.isError || ledger.isWaitingForNetwork)) {
        return (
            <Notice role="status" tone="danger">
                {t('totalsWait')}
            </Notice>
        );
    }
    if (missing.length > 0) return null;

    const balances = ledgers.map(({ group, entries }) => myBalance(group, entries));
    const owed = balances.filter((cents) => cents > 0).reduce((sum, cents) => sum + cents, 0);
    const owe = balances.filter((cents) => cents < 0).reduce((sum, cents) => sum - cents, 0);
    const amount = (cents: number) => formatAmount(cents, DEFAULT_CURRENCY, locale);

    if (owed === 0 && owe === 0) return <Notice role="status">{t('balance.allSettled')}</Notice>;

    return (
        <div className="groups__totals">
            {owed > 0 && <Notice role="status">{t('balance.owed', { amount: amount(owed) })}</Notice>}
            {owe > 0 && <Notice role="status">{t('balance.owe', { amount: amount(owe) })}</Notice>}
        </div>
    );
};

export { Groups };
