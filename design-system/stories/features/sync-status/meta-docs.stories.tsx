import { SyncStatus } from '@/features/expenses/list/sync-status';
import { useOutbox } from '@/lib/offline';
import { AppData, sampleExpense } from '@stories/shared/app-data';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Decorator, Meta } from '@storybook/react-vite';

interface OutboxProps {
    unsent: number;
    refused: number;
}

// Puts what the story needs into the outbox of the signed-in person
const Outbox = (props: OutboxProps) => {
    const { unsent, refused } = props;
    const outbox = useOutbox();

    useEffect(() => {
        const made = Array.from({ length: unsent + refused }, (_, index) =>
            sampleExpense(`33333333-3333-4333-8333-33333333333${index}`, '2026-10-29')
        );
        void Promise.all(made.map((expense) => outbox.put(expense))).then(() =>
            Promise.all(made.slice(unsent).map((expense) => outbox.reject(expense, null)))
        );
    }, [outbox, unsent, refused]);

    return null;
};

// Offline, with a server that can't be reached, so what is put in the outbox stays there
const withOutbox: Decorator = (Story, context) => {
    const { unsent, refused } = context.parameters.outbox as OutboxProps;
    onlineManager.setOnline(false);

    return (
        <AppData key={context.id} api={{}}>
            {(api) => {
                api.state.offline = true;
                return (
                    <>
                        <Outbox unsent={unsent} refused={refused} />
                        <Story />
                    </>
                );
            }}
        </AppData>
    );
};

const Story: Meta = {
    title: 'Features/SyncStatus',
    component: SyncStatus,
    tags: ['!dev'],
    decorators: [withOutbox],
    parameters: {
        docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 200 } },
        outbox: { unsent: 3, refused: 0 },
    },
};

export const Basic = () => {
    return <SyncStatus />;
};

export const Refused = () => {
    return <SyncStatus />;
};

Refused.parameters = { outbox: { unsent: 1, refused: 2 } };

export default Story;
