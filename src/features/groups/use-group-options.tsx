import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Icon } from '@/components/icon/icon';

import { groupTitle, memberNames } from './member-names';

import type { SharedGroup } from '@core/shared-group';

// The groups before the friends, as the Groups tab lists them
const groupsFirst = (groups: readonly SharedGroup[]): SharedGroup[] => {
    return [...groups.filter((group) => group.kind !== 'direct'), ...groups.filter((group) => group.kind === 'direct')];
};

// What the screens call each group and friend, by its id: its name, or the other person's for a friend
const useGroupTitles = (groups: readonly SharedGroup[]): Map<string, string> => {
    const t = useTranslations('groups');

    return useMemo(() => {
        const words = {
            deleted: t('names.deleted'),
            numbered: (name: string, number: number) => t('names.numbered', { name, number }),
        };
        return new Map(groups.map((group) => [group.id, groupTitle(group, memberNames(group.members, words))]));
    }, [groups, t]);
};

// The options of a Select of groups and friends: each by the name the screens give it, with its icon
const useGroupOptions = (groups: readonly SharedGroup[]) => {
    const titles = useGroupTitles(groups);

    return useMemo(
        () =>
            groups.map((group) => ({
                value: group.id,
                label: titles.get(group.id) ?? '',
                icon: <Icon name={group.kind === 'direct' ? 'person' : 'groups'} />,
            })),
        [groups, titles]
    );
};

export { groupsFirst, useGroupOptions, useGroupTitles };
