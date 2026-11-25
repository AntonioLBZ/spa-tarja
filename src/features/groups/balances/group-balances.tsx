import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Amount } from '@/components/amount/amount';
import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Icon } from '@/components/icon/icon';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { useGroupWords } from '@/features/groups/words/use-group-words';
import { useAmount } from '@/lib/amounts';
import { memberBalances, type Debt, type MemberBalance } from '@core/groups/balance';

import type { SharedEntry } from '@core/groups/shared-entry';
import type { SharedGroup } from '@core/groups/shared-group';

import './group-balances.css';

interface GroupBalancesProps {
    group: SharedGroup;
    // Deleted ones included, which count for nothing
    entries: readonly SharedEntry[];
    // The debts the group shows, pair by pair or simplified
    debts: readonly Debt[];
    // Takes a debt to settle up; without it, as in a closed group, no line offers it
    onSettle?: (debt: Debt) => void;
    // Settle up, at the end of the row of the label (ADR-0041)
    action?: ReactNode;
}

// You first, then who gets back the most, then who owes the most, then who is even but still in a debt (pair by pair,
// owing one and owed as much by another); who is in none apart
const rowsInOrder = (balances: readonly MemberBalance[], debts: readonly Debt[], me: string) => {
    const inDebts = (memberId: string) => debts.some((debt) => debt.from === memberId || debt.to === memberId);
    const moves = (balance: MemberBalance) => balance.cents !== 0 || inDebts(balance.memberId);
    const others = balances.filter((balance) => balance.memberId !== me && moves(balance));
    return {
        moving: [
            ...balances.filter((balance) => balance.memberId === me && moves(balance)),
            ...others.filter((balance) => balance.cents > 0).sort((a, b) => b.cents - a.cents),
            ...others.filter((balance) => balance.cents < 0).sort((a, b) => a.cents - b.cents),
            ...others.filter((balance) => balance.cents === 0),
        ],
        settled: balances.filter((balance) => !moves(balance)),
    };
};

// The balances of a group, a folded row per person after their net balance, and under it the debts that make it up,
// from their side (ADR-0029)
const GroupBalances = (props: GroupBalancesProps) => {
    const { group, entries, debts, onSettle, action } = props;
    const t = useTranslations('groups');
    const words = useGroupWords(group);
    const amount = useAmount();
    const me = group.me;
    const balances = useMemo(() => memberBalances(entries, group.members), [entries, group.members]);
    const { moving, settled } = useMemo(() => rowsInOrder(balances, debts, me), [balances, debts, me]);
    // A settlement is only between two members who haven't left
    const present = (memberId: string) =>
        group.members.some((member) => member.id === memberId && member.leftAt === null);

    const head = (memberId: string, cents: number) => {
        const name = words.nameOf(memberId);
        if (memberId === me) {
            if (cents === 0) return t('debts.youEven');
            return cents > 0 ? t('debts.youGetBack') : t('debts.youOweAll');
        }
        if (cents === 0) return t('debts.even', { name });
        return cents > 0 ? t('debts.getsBack', { name }) : t('debts.owesAll', { name });
    };

    // A debt as a short sentence of its own from the side of the person of the row
    const line = (debt: Debt, person: string) => {
        const from = words.nameOf(debt.from);
        const to = words.nameOf(debt.to);
        if (debt.to === me) return t('debts.lineOwesYou', { name: from });
        if (debt.from === me) return t('debts.lineYouOwe', { name: to });
        return debt.to === person ? t('debts.lineIn', { from, to }) : t('debts.lineOut', { from, to });
    };

    return (
        <Sheet label={t('debts.label')} action={action}>
            {group.simplifyDebts && <Notice tone="quiet">{t('debts.simplified')}</Notice>}
            {moving.length === 0 && <p className="group-balances__none">{t('debts.none')}</p>}
            {moving.length > 0 && (
                <ul className="group-balances" role="list">
                    {moving.map((balance) => {
                        const person = balance.memberId;
                        const lines = debts.filter((debt) => debt.from === person || debt.to === person);

                        return (
                            <Disclosure
                                as="li"
                                className="group-balances__person"
                                key={person}
                                chevron
                                wideChevron
                                summary={
                                    <span className="group-balances__head">
                                        <span className="group-balances__text">{head(person, balance.cents)}</span>{' '}
                                        <Amount
                                            {...amount(balance.cents, group.currency, { cues: true, arrow: true })}
                                        />
                                    </span>
                                }
                            >
                                <ul className="group-balances__debts" role="list">
                                    {lines.map((debt) => {
                                        const sentence = words.debt(debt);
                                        const cents = debt.to === person ? debt.cents : -debt.cents;
                                        // On both lines of a debt, under whoever owes and whoever is owed
                                        const settles = onSettle && present(debt.from) && present(debt.to);

                                        return (
                                            <li className="group-balances__debt" key={`${debt.from} ${debt.to}`}>
                                                <span className="visually-hidden">{sentence}</span>
                                                <span className="group-balances__line" aria-hidden="true">
                                                    <span className="group-balances__text">{line(debt, person)}</span>
                                                    <Amount
                                                        {...amount(cents, group.currency, { cues: true, arrow: true })}
                                                    />
                                                </span>
                                                {settles && (
                                                    <Button
                                                        ghost
                                                        glyph
                                                        aria-label={t('settle.lineItem', { debt: sentence })}
                                                        onClick={() => onSettle(debt)}
                                                    >
                                                        <Icon name="payments" />
                                                    </Button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Disclosure>
                        );
                    })}
                    {settled.map((balance) => (
                        <li className="group-balances__settled" key={balance.memberId}>
                            {words.sentence(balance.memberId, 0)}
                        </li>
                    ))}
                </ul>
            )}
        </Sheet>
    );
};

export { GroupBalances, type GroupBalancesProps };
