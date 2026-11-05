import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Icon } from '@/components/icon/icon';

import { groupTitle, memberNames } from './member-names';

import type { SharedGroup } from '@core/shared-group';

// The groups before the friends, as the Groups tab lists them
const groupsFirst = (groups: readonly SharedGroup[]): SharedGroup[] => {
    return [...groups.filter((group) => group.kind !== 'direct'), ...groups.filter((group) => group.kind === 'direct')];
};

// The options of a Select of groups and friends: each by the name the screens give it, with its icon
const useGroupOptions = (groups: readonly SharedGroup[]) => {
    const t = useTranslations('groups');

    return useMemo(() => {
        const words = {
            deleted: t('names.deleted'),
            numbered: (name: string, number: number) => t('names.numbered', { name, number }),
        };
        return groups.map((group) => ({
            value: group.id,
            label: groupTitle(group, memberNames(group.members, words)),
            icon: <Icon name={group.kind === 'direct' ? 'person' : 'groups'} />,
        }));
    }, [groups, t]);
};

export { groupsFirst, useGroupOptions };
