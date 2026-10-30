import { createContext, use, type ReactNode } from 'react';

import type { Outbox } from './outbox';

const OutboxContext = createContext<Outbox | null>(null);

interface OutboxProviderProps {
    outbox: Outbox;
    children: ReactNode;
}

const OutboxProvider = (props: OutboxProviderProps) => {
    const { outbox, children } = props;
    return <OutboxContext value={outbox}>{children}</OutboxContext>;
};

const useOutbox = (): Outbox => {
    const outbox = use(OutboxContext);
    if (outbox === null) throw new Error('useOutbox needs an OutboxProvider');
    return outbox;
};

export { OutboxProvider, useOutbox, type OutboxProviderProps };
