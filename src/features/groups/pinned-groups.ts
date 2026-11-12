import { useMemo } from 'react';

import { useGroups } from './use-ledgers';

import type { SharedGroup } from '@core/shared-group';

// The open groups and friends the person pinned to the Expenses screen, in the order they were pinned (ADR-0018)
const pinnedGroups = (groups: readonly SharedGroup[]): SharedGroup[] => {
    return groups
        .filter((group) => group.closed === null && group.pinnedAt !== null)
        .sort((a, b) => (a.pinnedAt ?? 0) - (b.pinnedAt ?? 0) || a.id.localeCompare(b.id));
};

const usePinnedGroups = (): SharedGroup[] => {
    const { groups } = useGroups();
    return useMemo(() => pinnedGroups(groups), [groups]);
};

export { pinnedGroups, usePinnedGroups };
