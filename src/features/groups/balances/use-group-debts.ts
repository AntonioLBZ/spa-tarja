import { useMemo } from 'react';

import { groupDebts } from '@core/group-debts';

import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// The debts a group's screen shows, worked out once for the balances and for Settle up. While a settlement is being
// edited the form reads the entries and the debts without it, as it is about to replace it.
const useGroupDebts = (group: SharedGroup, entries: readonly SharedEntry[], editingId: string | null) => {
    const { members, simplifyDebts } = group;
    const debts = useMemo(() => groupDebts(entries, members, simplifyDebts), [entries, members, simplifyDebts]);
    const formEntries = useMemo(
        () => (editingId === null ? entries : entries.filter((entry) => entry.id !== editingId)),
        [entries, editingId]
    );
    const formDebts = useMemo(
        () => (formEntries === entries ? debts : groupDebts(formEntries, members, simplifyDebts)),
        [formEntries, entries, debts, members, simplifyDebts]
    );

    return { debts, formEntries, formDebts };
};

export { useGroupDebts };
