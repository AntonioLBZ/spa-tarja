import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, use, useLayoutEffect, useState, type ReactNode } from 'react';

import { bindApiUser } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { createQueryClient } from '@/lib/query-client';

import { GROUP_OUTBOX_STORAGE_KEY, OUTBOX_STORAGE_KEY, createOutbox, type PendingEntry } from './outbox';
import { OutboxProvider } from './outbox-context';
import { createPersistOptions } from './persister';
import { createUserStorage } from './user-storage';

import type { KeyValueStorage } from './storage';
import type { Expense } from '@core/expense';

interface UserData {
    // Deletes what the signed-in user keeps on this device
    discard: () => Promise<void>;
}

const UserDataContext = createContext<UserData | null>(null);

interface UserDataProviderProps {
    storage: KeyValueStorage;
    children: ReactNode;
}

// The outboxes and the cache of the signed-in user, kept on the device apart from any other account's. When the user is
// signed out, by the button or by the server saying so, their copy goes with the session unless a write is still
// waiting to be sent in either outbox, which stays for their next sign-in.
const UserDataProvider = (props: UserDataProviderProps) => {
    const { storage, children } = props;
    const user = useUser();
    const { check, getState } = useAuth();
    const [data] = useState(() => {
        const mine = createUserStorage(storage, user.id);
        const outbox = createOutbox<Expense>(mine.storage, OUTBOX_STORAGE_KEY);
        const groupOutbox = createOutbox<PendingEntry>(mine.storage, GROUP_OUTBOX_STORAGE_KEY);
        const discardWhenIdle = async () => {
            await Promise.all([outbox.ready, groupOutbox.ready]);
            const waiting = outbox.getState().pending.length + groupOutbox.getState().pending.length;
            if (waiting === 0) await mine.discard();
        };
        return {
            outbox,
            groupOutbox,
            queryClient: createQueryClient({ onUnauthorized: check }),
            persistOptions: createPersistOptions(mine.storage),
            userData: { discard: mine.discard },
            discardWhenIdle,
        };
    });

    // Every call says it is for this user, and what this window had waiting to be sent stops with it
    useLayoutEffect(() => {
        const unbind = bindApiUser(user.id);
        data.outbox.resume();
        data.groupOutbox.resume();
        return () => {
            unbind();
            data.outbox.pause();
            data.groupOutbox.pause();
            if (getState().status === 'signed-out') void data.discardWhenIdle().catch(() => undefined);
        };
    }, [user.id, data, getState]);

    return (
        <UserDataContext value={data.userData}>
            <OutboxProvider outbox={data.outbox} groupOutbox={data.groupOutbox}>
                <PersistQueryClientProvider client={data.queryClient} persistOptions={data.persistOptions}>
                    {children}
                </PersistQueryClientProvider>
            </OutboxProvider>
        </UserDataContext>
    );
};

const useUserData = (): UserData => {
    const userData = use(UserDataContext);
    if (userData === null) throw new Error('useUserData needs a UserDataProvider');
    return userData;
};

export { UserDataProvider, useUserData, type UserDataProviderProps };
