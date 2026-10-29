import { SyncStatus } from '@/features/expenses/sync-status';
import { useOutbox } from '@/lib/offline';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

import { AppData, sampleExpense } from './app-data';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Puts what the story needs into the outbox of the signed-in person
function Seed(props: { unsent?: number; refused?: number }) {
    const { unsent = 0, refused = 0 } = props;
    const outbox = useOutbox();

    useEffect(() => {
        const made = Array.from({ length: unsent + refused }, (_, index) =>
            sampleExpense(`33333333-3333-4333-8333-33333333333${index}`, '2026-10-29')
        );
        void Promise.all(made.map((expense) => outbox.put(expense))).then(() =>
            Promise.all(made.slice(unsent).map((expense) => outbox.reject(expense)))
        );
    }, [outbox, unsent, refused]);

    return null;
}

function Status(props: { offline?: boolean; unsent?: number; refused?: number }) {
    const { offline = false, unsent, refused } = props;

    useEffect(() => {
        onlineManager.setOnline(!offline);
        return () => onlineManager.setOnline(navigator.onLine);
    }, [offline]);

    return (
        // A server that can't be reached keeps what was put in the outbox from being sent
        <AppData api={{}}>
            {(api) => {
                api.state.offline = true;
                return (
                    <>
                        <Seed unsent={unsent} refused={refused} />
                        <SyncStatus />
                    </>
                );
            }}
        </AppData>
    );
}

const meta = {
    title: 'Features/SyncStatus',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Offline: Story = { render: () => <Status offline /> };

const Waiting: Story = { render: () => <Status unsent={2} /> };

const Refused: Story = { render: () => <Status refused={1} /> };

const Everything: Story = { render: () => <Status offline unsent={3} refused={2} /> };

export default meta;
export { Everything, Offline, Refused, Waiting };
