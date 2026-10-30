import { SyncStatus as SyncStatusComponent } from '@/features/expenses/sync-status';
import { useOutbox } from '@/lib/offline';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

import { AppData, sampleExpense } from './app-data';

import type { Meta } from '@storybook/react-vite';

interface SeedProps {
    unsent: number;
    refused: number;
}

// Puts what the story needs into the outbox of the signed-in person
const Seed = (props: SeedProps) => {
    const { unsent, refused } = props;
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
};

interface SyncStatusStoryProps {
    offline: boolean;
    // Expenses waiting to be sent, and expenses the server refused
    unsent: number;
    refused: number;
}

const Story: Meta<SyncStatusStoryProps> = {
    title: 'Features/SyncStatus',
    args: { offline: true, unsent: 3, refused: 2 },
};

export const SyncStatus = (args: SyncStatusStoryProps) => {
    const { offline, unsent, refused } = args;

    useEffect(() => {
        onlineManager.setOnline(!offline);
        return () => onlineManager.setOnline(navigator.onLine);
    }, [offline]);

    return (
        // A server that can't be reached keeps what was put in the outbox from being sent
        <AppData key={`${unsent}:${refused}`} api={{}}>
            {(api) => {
                api.state.offline = true;
                return (
                    <>
                        <Seed unsent={unsent} refused={refused} />
                        <SyncStatusComponent />
                    </>
                );
            }}
        </AppData>
    );
};

export default Story;
