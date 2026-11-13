import { useParams, useSearch } from '@tanstack/react-router';

import { useGroups } from './use-ledgers';

import type { SharedGroup } from '@core/shared-group';

// The group of the screen the person is on, the group itself, its settings or its tab on the Expenses screen, while it
// is open for them
const useScreenGroup = (): SharedGroup | null => {
    const { groupId } = useParams({ strict: false });
    const { group: tab } = useSearch({ strict: false });
    const { groups } = useGroups();
    const id = groupId ?? tab;
    if (!id) return null;
    const group = groups.find((item) => item.id === id.toLowerCase());
    return group && group.closed === null ? group : null;
};

export { useScreenGroup };
