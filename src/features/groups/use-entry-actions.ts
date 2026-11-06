import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { useGroupOutbox } from '@/lib/offline';

import { LocalRefusal } from './local-refusal';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// Writing an entry never waits for the network: it is safe on the device, and in the ledger, once this resolves. A group
// closed for the person, or one the device doesn't hold, is read-only, so the write never reaches the outbox. It rejects
// for that, or when the device can't store it.
const useEntryActions = () => {
    const outbox = useGroupOutbox();
    const queryClient = useQueryClient();

    return useMemo(() => {
        const save = async (groupId: string, entry: SharedEntry) => {
            const group = queryClient.getQueryData<SharedGroup[]>(GROUPS_KEY)?.find((item) => item.id === groupId);
            if (!group || group.closed !== null) throw new LocalRefusal('read-only');
            await outbox.put({ ...entry, groupId });
            void queryClient.invalidateQueries({ queryKey: groupEntriesKey(groupId) });
        };

        return {
            save,
            // Deletes with no question asked; the deleted entry it answers is what Undo takes back. Later than the version
            // it replaces, so a device whose clock runs behind still wins over it (ADR-0005).
            async remove(groupId: string, entry: SharedEntry): Promise<SharedEntry> {
                const at = Math.max(Date.now(), entry.updatedAt + 1);
                const deleted = { ...entry, updatedAt: at, deletedAt: at };
                await save(groupId, deleted);
                return deleted;
            },
            // Undo: the entry again, newer than its delete so it wins on every device
            async restore(groupId: string, deleted: SharedEntry) {
                const updatedAt = Math.max(Date.now(), (deleted.deletedAt ?? deleted.updatedAt) + 1);
                await save(groupId, { ...deleted, updatedAt, deletedAt: null });
            },
        };
    }, [outbox, queryClient]);
};

export { useEntryActions };
