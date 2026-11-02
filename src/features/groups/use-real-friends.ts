import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { memberNames } from './member-names';
import { useGroups } from './use-ledgers';

// A friend who uses the app: the id of the friend, which adding them to a group names, and the other person's name
interface RealFriend {
    id: string;
    name: string;
}

// The person's open friends whose other member has joined, the ones a group can take. A member carries no user, so
// whether one of them is in a group already is the server's to say.
const useRealFriends = (): RealFriend[] => {
    const { groups } = useGroups();
    const t = useTranslations('groups.names');

    return useMemo(() => {
        const others = groups.flatMap((group) => {
            if (group.kind !== 'direct' || group.closed !== null) return [];
            const other = group.members.find((member) => member.id !== group.me);
            return other?.claimed ? [{ id: group.id, member: other }] : [];
        });
        const names = memberNames(
            others.map(({ member }) => member),
            { deleted: t('deleted'), numbered: (name, number) => t('numbered', { name, number }) }
        );
        return others.map(({ id, member }) => ({ id, name: names.get(member.id) ?? member.name }));
    }, [groups, t]);
};

export { useRealFriends, type RealFriend };
