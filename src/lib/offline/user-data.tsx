import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, use, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { bindApiUser } from '@/lib/api';
import { createQueryClient } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { forgetPushInBrowser } from '@/lib/push';

import { createHomeTab, type HomeTab } from './home-tab';
import { GROUP_OUTBOX_STORAGE_KEY, OUTBOX_STORAGE_KEY, createOutbox, type PendingEntry } from './outbox';
import { OutboxProvider } from './outbox-context';
import { createPersistOptions } from './persister';
import { createUserStorage } from './user-storage';

import type { KeyValueStorage } from './storage';
import type { Expense } from '@core/expenses/expense';

interface UserData {
    // Deletes what the signed-in user keeps on this device
    discard: () => Promise<void>;
    // The tab the Expenses screen opens on, followed from the load of the page
    homeTab: HomeTab;
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
        const persistOptions = createPersistOptions(mine.storage);
        // What the server kept is written to the cache on the device before the outbox lets go of the write
        const flushCache = () => persistOptions.persister.flush();
        const outbox = createOutbox<Expense>(mine.storage, OUTBOX_STORAGE_KEY, flushCache);
        const groupOutbox = createOutbox<PendingEntry>(mine.storage, GROUP_OUTBOX_STORAGE_KEY, flushCache);
        // Nothing waits in this window, nor on the device: another window may have saved a write since this one opened
        const discardWhenIdle = async () => {
            await Promise.all([outbox.ready, groupOutbox.ready]);
            const waiting = outbox.getState().pending.length + groupOutbox.getState().pending.length;
            if (waiting > 0) return;
            const saved = await Promise.all(
                [OUTBOX_STORAGE_KEY, GROUP_OUTBOX_STORAGE_KEY].map((key) => mine.storage.get<unknown[]>(key))
            );
            if (saved.every((items) => !items?.length)) await mine.discard();
        };
        return {
            outbox,
            groupOutbox,
            queryClient: createQueryClient({ onUnauthorized: check }),
            persistOptions,
            userData: { discard: mine.discard, homeTab: createHomeTab(user.id) },
            discardWhenIdle,
        };
    });

    // The copy of the cache waiting to be written is written as the page is hidden or left, which is all a phone says
    // before it closes the app
    useEffect(() => {
        const { persister } = data.persistOptions;
        const flush = () => void persister.flush().catch(() => undefined);
        const flushWhenHidden = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        document.addEventListener('visibilitychange', flushWhenHidden);
        window.addEventListener('pagehide', flush);
        return () => {
            document.removeEventListener('visibilitychange', flushWhenHidden);
            window.removeEventListener('pagehide', flush);
        };
    }, [data]);

    // Every call says it is for this user, and what this window had waiting to be sent stops with it
    useLayoutEffect(() => {
        const unbind = bindApiUser(user.id);
        data.outbox.resume();
        data.groupOutbox.resume();
        return () => {
            unbind();
            data.outbox.pause();
            data.groupOutbox.pause();
            if (getState().status !== 'signed-out') {
                void data.persistOptions.persister.flush().catch(() => undefined);
                return;
            }
            // Whatever is waiting to be sent, this device stops getting the notifications of who signed out
            void forgetPushInBrowser().catch(() => undefined);
            void data.discardWhenIdle().catch(() => undefined);
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

// The group of the tab of the Expenses screen shown last, null for Expenses
const useLastHomeTab = (): string | null => {
    const { homeTab } = useUserData();
    return useSyncExternalStore(homeTab.subscribe, homeTab.last);
};

export { UserDataProvider, useLastHomeTab, useUserData, type UserDataProviderProps };
