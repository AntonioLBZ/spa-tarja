import { onlineManager } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { applyAccent, readStoredAccent } from './lib/accent';
import { createAuth, createAuthService } from './lib/auth';
import { idbStorage } from './lib/offline';
import { applyTheme, readStoredTheme } from './lib/theme';
import { AppProviders } from './providers';
import { createAppRouter } from './router';

import './assets/styles/main.css';

// Before the first render, so a stored theme and accent paint from the start
applyTheme(readStoredTheme());
applyAccent(readStoredAccent());

// Query assumes it is online until an event says otherwise, which never comes when the app opens offline
onlineManager.setOnline(navigator.onLine);

const auth = createAuth(createAuthService());
const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppProviders auth={auth} storage={idbStorage}>
            <RouterProvider router={router} />
        </AppProviders>
    </StrictMode>
);
