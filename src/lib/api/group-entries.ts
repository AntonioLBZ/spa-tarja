import { toApiError } from './api-error';
import { api } from './client';

import type { LedgerEntry, SharedEntry } from '@core/shared-entry';

// Every entry of a group this device knows about, deleted ones included, and the group's cursor of the last change seen
interface GroupEntriesState {
    entries: LedgerEntry[];
    cursor: number;
    // The last pull was made once the group was closed for the person, so these are all its entries there will be
    final?: true;
}

interface EntryChanges {
    entries: LedgerEntry[];
    cursor: number;
    hasMore: boolean;
}

const GROUP_ENTRIES_KEY = 'group-entries';

const groupEntriesKey = (groupId: string) => {
    return [GROUP_ENTRIES_KEY, groupId] as const;
};

const fetchEntryChanges = async (groupId: string, after: number): Promise<EntryChanges> => {
    const response = await api.api.groups[':groupId'].entries.$get({
        param: { groupId },
        query: { after: String(after) },
    });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

// Creates or updates by id in its group, so sending it twice is harmless. A refusal carries its reason in `code`.
const putEntry = async (entry: SharedEntry & { groupId: string }): Promise<LedgerEntry> => {
    const { groupId, id, ...body } = entry;
    const response = await api.api.groups[':groupId'].entries[':id'].$put({ param: { groupId, id }, json: body });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

export { GROUP_ENTRIES_KEY, fetchEntryChanges, groupEntriesKey, putEntry, type EntryChanges, type GroupEntriesState };
