import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// What an entry says, apart from what every new one of a group gets
type EntryFields = SharedEntry extends infer Entry
    ? Entry extends SharedEntry
        ? Omit<Entry, 'id' | 'currency' | 'createdAt' | 'updatedAt' | 'deletedAt'>
        : never
    : never;

// A new entry of the group: an id of its own, the group's currency, made and written now
const newEntry = (group: SharedGroup, fields: EntryFields): SharedEntry => {
    const now = Date.now();
    return {
        ...fields,
        id: crypto.randomUUID(),
        currency: group.currency,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
    };
};

export { newEntry, type EntryFields };
