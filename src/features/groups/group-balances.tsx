import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
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
    // Takes a debt to settle up; without it, as in a closed group, no line offers it
    onSettle?: (debt: Debt) => void;
}

// The debts the person is in come first, the rest in the group's order
const yoursFirst = (debts: readonly Debt[], me: string): Debt[] => {
    const yours = (debt: Debt) => debt.from === me || debt.to === me;
    return [...debts.filter(yours), ...debts.filter((debt) => !yours(debt))];
};

// Who owes whom in a group, pair by pair, each with the way to settle it, and under it what each member is owed or owes
const GroupBalances = (props: GroupBalancesProps) => {
    const { group, entries, onSettle } = props;
    const t = useTranslations('groups');
    const words = useGroupWords(group);
    const debts = useMemo(() => yoursFirst(pairwiseDebts(entries, group.members), group.me), [entries, group]);
    const balances = useMemo(() => memberBalances(entries, group.members), [entries, group.members]);
    // A settlement is only between two members who haven't left
    const present = (memberId: string) =>
        group.members.some((member) => member.id === memberId && member.leftAt === null);

    return (
        <Sheet label={t('debts.label')}>
            {debts.length === 0 ? (
                <p className="group-balances__line">{t('debts.none')}</p>
            ) : (
                <CardList flush>
                    {debts.map((debt) => {
                        const sentence = words.debt(debt);

                        return (
                            <li className="group-balances__line" key={`${debt.from} ${debt.to}`}>
                                <span className="group-balances__text">{sentence}</span>
                                {onSettle && present(debt.from) && present(debt.to) && (
                                    <Button
                                        ghost
                                        aria-label={t('settle.lineItem', { debt: sentence })}
                                        onClick={() => onSettle(debt)}
                                    >
                                        {t('settle.title')}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </CardList>
            )}
            <Disclosure summary={t('debts.everyone')} chevron>
                <CardList flush label={t('debts.everyone')}>
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
