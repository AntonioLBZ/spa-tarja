import { useMemo } from 'react';

import { sharedExpenseRows, type SharedExpenseRow } from '@core/shared-expense';

import { useLedgers } from './use-ledgers';

// Your part of the expenses of every group whose switch Show in my expenses is on, as rows of your own expenses; an
// unsynced write is there at once, and its row has the id of the entry, by which the outbox tells it is waiting
const useSharedExpenseRows = (): SharedExpenseRow[] => {
    const { ledgers } = useLedgers();

    return useMemo(
        () =>
            sharedExpenseRows(
                ledgers.map(({ group, entries }) => ({
                    groupId: group.id,
                    me: group.me,
                    showInExpenses: group.showInExpenses,
                    members: group.members,
                    entries,
                }))
            ),
        [ledgers]
    );
};

export { useSharedExpenseRows };
