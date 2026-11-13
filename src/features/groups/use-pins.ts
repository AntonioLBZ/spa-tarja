import { useState } from 'react';

import { useOnline } from '@/lib/offline';
import { MAX_PINNED_GROUPS } from '@core/shared-group';

import { failureOf, type GroupFailure } from './group-failure';
import { usePinnedGroups } from './pinned-groups';
import { useGroupActions } from './use-group-actions';

import type { SharedGroup } from '@core/shared-group';

interface Pins {
    // Whether the group shows as pinned: what was asked for until the server answers
    isPinned: (group: SharedGroup) => boolean;
    // Whether its pin can be pressed now
    canToggle: (group: SharedGroup) => boolean;
    toggle: (group: SharedGroup) => Promise<void>;
    // As many pinned as there can be
    full: boolean;
    failure: GroupFailure | null;
}

// The pins of the groups of a screen (ADR-0021): one change at a time, and only with a connection
const usePins = (): Pins => {
    const online = useOnline();
    const { setSwitches } = useGroupActions();
    const pinned = usePinnedGroups();
    const [asked, setAsked] = useState<{ id: string; pinned: boolean } | null>(null);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const full = pinned.length >= MAX_PINNED_GROUPS;

    const isPinned = (group: SharedGroup) => {
        return asked?.id === group.id ? asked.pinned : group.pinnedAt !== null;
    };

    const canToggle = (group: SharedGroup) => {
        return online && asked === null && group.closed === null && (isPinned(group) || !full);
    };

    const toggle = async (group: SharedGroup) => {
        if (!canToggle(group)) return;
        const next = !isPinned(group);
        setAsked({ id: group.id, pinned: next });
        setFailure(null);
        try {
            await setSwitches(group.id, { pinned: next });
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setAsked(null);
        }
    };

    return { isPinned, canToggle, toggle, full, failure };
};

export { usePins, type Pins };
