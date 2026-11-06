import { useTranslations } from 'use-intl';

import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { AddFriend } from './add-friend';
import { EntryRefusals } from './entry-refusals';
import { GroupList } from './group-list';
import { InviteFriend } from './invite-friend';
import { myBalance } from './my-balance';
import { NewGroup } from './new-group';
import { useGroups, useLedgers, type Ledger } from './use-ledgers';

import './groups.css';

interface GroupTotalsProps {
    ledgers: readonly Ledger[];
}

// The Groups tab: what the person is owed and owes across their open groups and friends, making a group, inviting a
// friend with a link or adding one by name, the groups and the friends, and at the end the closed and the archived ones
const Groups = () => {
    const t = useTranslations('groups');
    const online = useOnline();
    const { hasData, isError, isWaitingForNetwork } = useGroups();
    const { ledgers } = useLedgers();

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
            {!hasData && (isError || isWaitingForNetwork) && <Notice tone="danger">{t('group.loadFailed')}</Notice>}
            {hasData && (open.length > 0 ? <GroupTotals ledgers={open} /> : <Notice tone="quiet">{t('empty')}</Notice>)}
            <NewGroup disabled={!online} />
            <InviteFriend disabled={!online} />
            <AddFriend disabled={!online} />
            {groups.length > 0 && <GroupList label={t('lists.groups')} ledgers={groups} />}
            {friends.length > 0 && <GroupList label={t('lists.friends')} ledgers={friends} />}
            {closed.length > 0 && (
                <Disclosure summary={t('lists.closed')} chevron>
                    <GroupList label={t('lists.closed')} ledgers={closed} />
                </Disclosure>
            )}
            {archived.length > 0 && (
                <Disclosure summary={t('lists.archived')} chevron>
                    <GroupList label={t('lists.archived')} ledgers={archived} />
                </Disclosure>
            )}
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
        return <Notice tone="danger">{t('totalsWait')}</Notice>;
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
