import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { CardList } from '@/components/card/card';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Sheet } from '@/components/sheet/sheet';
import { memberBalances, pairwiseDebts, type Debt } from '@core/balance';

import { useGroupWords } from './use-group-words';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

import './group-balances.css';

interface GroupBalancesProps {
    group: SharedGroup;
    // Deleted ones included, which count for nothing
    entries: readonly SharedEntry[];
}

// The debts the person is in come first, the rest in the group's order
const yoursFirst = (debts: readonly Debt[], me: string): Debt[] => {
    const yours = (debt: Debt) => debt.from === me || debt.to === me;
    return [...debts.filter(yours), ...debts.filter((debt) => !yours(debt))];
};

// Who owes whom in a group, pair by pair, and under it what each member is owed or owes
const GroupBalances = (props: GroupBalancesProps) => {
    const { group, entries } = props;
    const t = useTranslations('groups.debts');
    const words = useGroupWords(group);
    const debts = useMemo(() => yoursFirst(pairwiseDebts(entries, group.members), group.me), [entries, group]);
    const balances = useMemo(() => memberBalances(entries, group.members), [entries, group.members]);

    return (
        <Sheet label={t('label')}>
            {debts.length === 0 ? (
                <p className="group-balances__line">{t('none')}</p>
            ) : (
                <CardList flush>
                    {debts.map((debt) => (
                        <li className="group-balances__line" key={`${debt.from} ${debt.to}`}>
                            {words.debt(debt)}
                        </li>
                    ))}
                </CardList>
            )}
            <Disclosure summary={t('everyone')} chevron>
                <CardList flush label={t('everyone')}>
                    {balances.map((balance) => (
                        <li className="group-balances__line" key={balance.memberId}>
                            {words.sentence(balance.memberId, balance.cents)}
                        </li>
                    ))}
                </CardList>
            </Disclosure>
        </Sheet>
    );
};

export { GroupBalances, type GroupBalancesProps };
