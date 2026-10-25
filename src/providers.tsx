import { AuthGate } from './features/auth/auth-gate';
import { AuthProvider, type Auth } from './lib/auth';
import { LocaleProvider } from './lib/i18n';
import { UserDataProvider, type KeyValueStorage } from './lib/offline';
import { ThemeProvider } from './lib/theme';

import type { ReactNode } from 'react';

// Everything the app needs around its pages: language, theme, and the signed-in user with their data. Without a
// signed-in user, the children are not rendered.
function AppProviders(props: { auth: Auth; storage: KeyValueStorage; children: ReactNode }) {
    const { auth, storage, children } = props;

    return (
        <LocaleProvider>
            <ThemeProvider>
                <AuthProvider auth={auth}>
                    <AuthGate>
                        <UserDataProvider storage={storage}>{children}</UserDataProvider>
                    </AuthGate>
                </AuthProvider>
            </ThemeProvider>
        </LocaleProvider>
    );
}

export { AppProviders };
