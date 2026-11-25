import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { useMoney } from '@/lib/amounts';
import { canonicalMember } from '@core/groups/shared-member';

import { groupTitle, memberNames } from './member-names';

import type { Debt } from '@core/groups/balance';
import type { SharedGroup } from '@core/groups/shared-group';

type ClosedReason = 'deleted' | 'deletedFriend' | 'left';

// How the screens name a group, its people and their debts, in words: owing isn't an error, never in the danger color
const useGroupWords = (group: SharedGroup) => {
    const t = useTranslations('groups');
    const money = useMoney();

    return useMemo(() => {
        const names = memberNames(group.members, {
            deleted: t('names.deleted'),
            numbered: (name, number) => t('names.numbered', { name, number }),
        });
        const amount = (cents: number) => money(Math.abs(cents), group.currency);

        // The member an id is read as, with "(left)" when they left the group
        const nameOf = (memberId: string) => {
            const id = canonicalMember(group.members, memberId);
            const name = names.get(id) ?? t('names.unknown');
            const left = group.members.find((member) => member.id === id)?.leftAt != null;
            return left ? t('names.left', { name }) : name;
        };

        // A member as a list or a picker names them: the person gets "(You)" after the name the group knows them by,
        // where a sentence says plain "You"
        const nameInList = (memberId: string) => {
            const id = canonicalMember(group.members, memberId);
            return id === group.me ? t('names.you', { name: nameOf(id) }) : nameOf(id);
        };

        const title = groupTitle(group, names);

        // What the person is owed or owes in the group; `text` writes the amount another way
        const mine = (cents: number, text = amount(cents)) => {
            if (cents > 0) return t('balance.owed', { amount: text });
            if (cents < 0) return t('balance.owe', { amount: text });
            return t('balance.allSettled');
        };

        // What one member is owed or owes, the person included
        const sentence = (memberId: string, cents: number) => {
            if (memberId === group.me) return cents === 0 ? t('balance.youSettled') : mine(cents);
            const name = nameOf(memberId);
            if (cents > 0) return t('balance.memberOwed', { name, amount: amount(cents) });
            if (cents < 0) return t('balance.memberOwes', { name, amount: amount(cents) });
            return t('balance.memberSettled', { name });
        };

        // The balance of a row of the list: a friend who owes the person is named
        const row = (cents: number, text = amount(cents)) => {
            if (cents > 0 && group.kind === 'direct') return t('debts.owesYou', { name: title, amount: text });
            return cents === 0 ? t('row.settled') : mine(cents, text);
        };

        const debt = ({ from, to, cents }: Debt) => {
            if (from === group.me) return t('debts.youOwe', { name: nameOf(to), amount: amount(cents) });
            if (to === group.me) return t('debts.owesYou', { name: nameOf(from), amount: amount(cents) });
            return t('debts.owes', { from: nameOf(from), to: nameOf(to), amount: amount(cents) });
        };

        // Why a closed group is read-only: the copy of each says it its own way
        const closed: ClosedReason | null =
            group.closed === null
                ? null
                : group.closed === 'left'
                  ? 'left'
                  : group.kind === 'direct'
                    ? 'deletedFriend'
                    : 'deleted';

        return { title, closed, nameOf, nameInList, mine, row, sentence, debt };
    }, [group, money, t]);
};

export { useGroupWords };
