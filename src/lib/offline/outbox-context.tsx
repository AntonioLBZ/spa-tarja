import { createContext, use, type ReactNode } from 'react';

import type { Outbox, PendingEntry } from './outbox';
import type { Expense } from '@core/expense';

const OutboxContext = createContext<Outbox<Expense> | null>(null);
const GroupOutboxContext = createContext<Outbox<PendingEntry> | null>(null);

interface OutboxProviderProps {
    outbox: Outbox<Expense>;
    groupOutbox: Outbox<PendingEntry>;
    children: ReactNode;
}

const OutboxProvider = (props: OutboxProviderProps) => {
    const { outbox, groupOutbox, children } = props;
    return (
        <OutboxContext value={outbox}>
            <GroupOutboxContext value={groupOutbox}>{children}</GroupOutboxContext>
        </OutboxContext>
    );
};

// The expenses waiting to be sent
const useOutbox = (): Outbox<Expense> => {
    const outbox = use(OutboxContext);
    if (outbox === null) throw new Error('useOutbox needs an OutboxProvider');
    return outbox;
};

// The entries of groups waiting to be sent
const useGroupOutbox = (): Outbox<PendingEntry> => {
    const outbox = use(GroupOutboxContext);
    if (outbox === null) throw new Error('useGroupOutbox needs an OutboxProvider');
    return outbox;
};

export { OutboxProvider, useGroupOutbox, useOutbox, type OutboxProviderProps };
