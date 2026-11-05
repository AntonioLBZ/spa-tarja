import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { memberBalances, type Debt } from '@core/balance';

import { useGroupWords } from './use-group-words';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

import './group-balances.css';

interface GroupBalancesProps {
    group: SharedGroup;
    // Deleted ones included, which count for nothing
    entries: readonly SharedEntry[];
    // The debts the group shows, pair by pair or simplified
    debts: readonly Debt[];
    // Takes a debt to settle up; without it, as in a closed group, no line offers it
    onSettle?: (debt: Debt) => void;
}

// The debts the person is in come first, the rest in the group's order
const yoursFirst = (debts: readonly Debt[], me: string): Debt[] => {
    const yours = (debt: Debt) => debt.from === me || debt.to === me;
    return [...debts.filter(yours), ...debts.filter((debt) => !yours(debt))];
};

// The debts of a group, each with the way to settle it, and under them what each member is owed or owes
const GroupBalances = (props: GroupBalancesProps) => {
    const { group, entries, debts, onSettle } = props;
    const t = useTranslations('groups');
    const words = useGroupWords(group);
    const lines = useMemo(() => yoursFirst(debts, group.me), [debts, group.me]);
    const balances = useMemo(() => memberBalances(entries, group.members), [entries, group.members]);
    // A settlement is only between two members who haven't left
    const present = (memberId: string) =>
        group.members.some((member) => member.id === memberId && member.leftAt === null);

    return (
        <Sheet label={t('debts.label')}>
            {group.simplifyDebts && <Notice tone="quiet">{t('debts.simplified')}</Notice>}
            {lines.length === 0 ? (
                <p className="group-balances__line">{t('debts.none')}</p>
            ) : (
                <CardList flush>
                    {lines.map((debt) => {
                        const sentence = words.debt(debt);

                        return (
                            <li className="group-balances__line" key={`${debt.from} ${debt.to}`}>
                                <span className="group-balances__text">{sentence}</span>
                                {onSettle && present(debt.from) && present(debt.to) && (
                                    <Button
                                        ghost
                                        className="group-balances__settle"
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
