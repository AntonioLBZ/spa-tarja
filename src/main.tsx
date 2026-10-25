import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LocaleProvider } from './lib/i18n';
import { OutboxProvider, createOutbox, createPersistOptions, idbStorage } from './lib/offline';
import { createQueryClient } from './lib/query-client';
import { createAppRouter } from './router';

import './assets/styles/main.css';

// Query assumes it is online until an event says otherwise, which never comes when the app opens offline
onlineManager.setOnline(navigator.onLine);

const queryClient = createQueryClient();
const outbox = createOutbox(idbStorage);
const persistOptions = createPersistOptions(idbStorage);
const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LocaleProvider>
            <OutboxProvider outbox={outbox}>
                <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
                    <RouterProvider router={router} />
                </PersistQueryClientProvider>
            </OutboxProvider>
        </LocaleProvider>
    </StrictMode>
);
