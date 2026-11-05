import { useMemo } from 'react';

import { sharedExpenseRows, type SharedLedger } from '@core/shared-expense';

import { useExpenseLedgers } from './use-ledgers';

import type { LedgerEntry, SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

// The group and the entry a shared row of your expenses is from
interface SharedRowSource {
    group: SharedGroup;
    entry: Extract<LedgerEntry, { kind: 'expense' }>;
}

const ledgerOf = (group: SharedGroup, entries: readonly SharedEntry[]): SharedLedger => {
    return {
        groupId: group.id,
        me: group.me,
        showInExpenses: group.showInExpenses,
        members: group.members,
        entries,
    };
};

// The rows that your part of these entries of the group gives in your expenses, none while its switch is off
const sharedRowsOf = (group: SharedGroup, entries: readonly SharedEntry[]) => {
    return sharedExpenseRows([ledgerOf(group, entries)]);
};

// Your part of the expenses of every group whose switch Show in my expenses is on, as rows of your own expenses; an
// unsynced write is there at once, and its row has the id of the entry, by which the outbox tells it is waiting
const useSharedExpenseRows = () => {
    const { ledgers, pendingIds } = useExpenseLedgers();

    return useMemo(() => {
        const sources = new Map<string, SharedRowSource>();
        for (const { group, entries } of ledgers) {
            for (const entry of entries) if (entry.kind === 'expense') sources.set(entry.id, { group, entry });
        }

        return {
            rows: sharedExpenseRows(ledgers.map(({ group, entries }) => ledgerOf(group, entries))),
            // The ids of the person's writes to the groups that wait to be sent
            pendingIds,
            // Where a row is from, also once its entry is deleted, so that a row fading out still says it
            sourceOf: (rowId: string): SharedRowSource | undefined => sources.get(rowId),
        };
    }, [ledgers, pendingIds]);
};

export { sharedRowsOf, useSharedExpenseRows, type SharedRowSource };
