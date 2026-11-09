import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { useCategoryOptions } from '@/features/categories/use-category-options';
import { canonicalMember } from '@core/shared-member';

import { useGroupWords } from './use-group-words';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// How the screens name an entry of a group: an expense by its text, else its category, and a settlement by who paid
// whom, the person as "you"
const useEntryWords = (group: SharedGroup) => {
    const t = useTranslations('groups.ledger');
    const words = useGroupWords(group);
    const { labelOf } = useCategoryOptions();

    return useMemo(() => {
        const isMe = (memberId: string) => canonicalMember(group.members, memberId) === group.me;

        const entryName = (entry: SharedEntry) => {
            if (entry.kind === 'expense') return entry.text || labelOf(entry.categoryId);
            const from = entry.paidBy;
            const to = entry.shares[0]!.memberId;
            if (isMe(from)) return t('youPaidTo', { name: words.nameOf(to) });
            if (isMe(to)) return t('paidYou', { name: words.nameOf(from) });
            return t('paid', { from: words.nameOf(from), to: words.nameOf(to) });
        };

        return { ...words, isMe, entryName };
    }, [group, labelOf, t, words]);
};

export { useEntryWords };
