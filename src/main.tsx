import { onlineManager } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { appUpdate } from './features/pwa/app-update-state';
import { createAuth, createAuthService } from './lib/auth';
import { leaveSlidesToTheBrowser } from './lib/browser-slide';
import { idbStorage } from './lib/offline';
import { applyTheme, forgetStoredAccent, readStoredTheme } from './lib/theme';
import { endTransitionsOnTap } from './lib/view-transition-tap';
import { AppProviders } from './providers';
import { createAppRouter } from './router';

import './assets/styles/main.css';

// Before the first render, so a stored theme paints from the start
applyTheme(readStoredTheme());
forgetStoredAccent();

// Query assumes it is online until an event says otherwise, which never comes when the app opens offline
onlineManager.setOnline(navigator.onLine);

// Before the session and the data, so a new version is offered as soon as it is found
appUpdate.start();

// A tap never waits for a screen to finish sliding
endTransitionsOnTap();

// Before the router, so its own listener finds the slide already skipped
leaveSlidesToTheBrowser();

const auth = createAuth(createAuthService());
const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppProviders auth={auth} storage={idbStorage}>
            <RouterProvider router={router} />
        </AppProviders>
    </StrictMode>
);
