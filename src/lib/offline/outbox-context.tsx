import { createContext, use, type ReactNode } from 'react';

import type { Outbox } from './outbox';

const OutboxContext = createContext<Outbox | null>(null);

function OutboxProvider(props: { outbox: Outbox; children: ReactNode }) {
    const { outbox, children } = props;
    return <OutboxContext value={outbox}>{children}</OutboxContext>;
}

function useOutbox(): Outbox {
    const outbox = use(OutboxContext);
    if (outbox === null) throw new Error('useOutbox needs an OutboxProvider');
    return outbox;
}

export { OutboxProvider, useOutbox };
