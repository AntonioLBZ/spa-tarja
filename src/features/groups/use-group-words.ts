import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { useLocale } from '@/lib/i18n';
import { formatAmount } from '@core/money';
import { canonicalMember } from '@core/shared-member';

import { groupTitle, memberNames } from './member-names';

import type { Debt } from '@core/balance';
import type { SharedGroup } from '@core/shared-group';

type ClosedReason = 'deleted' | 'deletedFriend' | 'left';

// How the screens name a group, its people and their debts, in words: owing isn't an error, so it has no color
const useGroupWords = (group: SharedGroup) => {
    const t = useTranslations('groups');
    const { locale } = useLocale();

    return useMemo(() => {
        const names = memberNames(group.members, {
            deleted: t('names.deleted'),
            numbered: (name, number) => t('names.numbered', { name, number }),
        });
        const amount = (cents: number) => formatAmount(Math.abs(cents), group.currency, locale);

        // The member an id is read as, with "(left)" when they left the group
        const nameOf = (memberId: string) => {
            const id = canonicalMember(group.members, memberId);
            const name = names.get(id) ?? t('names.unknown');
            const left = group.members.find((member) => member.id === id)?.leftAt != null;
            return left ? t('names.left', { name }) : name;
        };

        const title = groupTitle(group, names);

        // What the person is owed or owes in the group
        const mine = (cents: number) => {
            if (cents > 0) return t('balance.owed', { amount: amount(cents) });
            if (cents < 0) return t('balance.owe', { amount: amount(cents) });
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
        const row = (cents: number) => {
            if (cents > 0 && group.kind === 'direct') return t('debts.owesYou', { name: title, amount: amount(cents) });
            return cents === 0 ? t('row.settled') : mine(cents);
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

        return { title, closed, nameOf, mine, row, sentence, debt };
    }, [group, locale, t]);
};

export { useGroupWords };
