import { useParams } from '@tanstack/react-router';

import { useGroups } from './use-ledgers';

import type { SharedGroup } from '@core/shared-group';

// The group of the screen the person is on, the group itself or its settings, while it is open for them
const useScreenGroup = (): SharedGroup | null => {
    const { groupId } = useParams({ strict: false });
    const { groups } = useGroups();
    if (!groupId) return null;
    const group = groups.find((item) => item.id === groupId.toLowerCase());
    return group && group.closed === null ? group : null;
};

export { useScreenGroup };
