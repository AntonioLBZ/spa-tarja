import { AuthGate } from './features/auth/auth-gate';
import { useFocusSource } from './lib/a11y';
import { AmountsProvider } from './lib/amounts';
import { AuthProvider, type Auth } from './lib/auth';
import { LocaleProvider } from './lib/i18n';
import { UserDataProvider, type KeyValueStorage } from './lib/offline';
import { ThemeProvider } from './lib/theme';
import { useOnScreenKeyboard } from './lib/viewport';

import type { ReactNode } from 'react';

interface AppProvidersProps {
    auth: Auth;
    storage: KeyValueStorage;
    children: ReactNode;
}

// Everything the app needs around its pages: language, theme, how amounts show, how the focus last moved, and the signed-in user with their data. Without a
// signed-in user, the children are not rendered.
const AppProviders = (props: AppProvidersProps) => {
    const { auth, storage, children } = props;
    useFocusSource();
    useOnScreenKeyboard();

    return (
        <LocaleProvider>
            <ThemeProvider>
                <AmountsProvider>
                    <AuthProvider auth={auth}>
                        <AuthGate>
                            <UserDataProvider storage={storage}>{children}</UserDataProvider>
                        </AuthGate>
                    </AuthProvider>
                </AmountsProvider>
            </ThemeProvider>
        </LocaleProvider>
    );
};

export { AppProviders, type AppProvidersProps };
