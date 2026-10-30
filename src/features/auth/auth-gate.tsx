import { useTranslations } from 'use-intl';

import { UserProvider, useAuth } from '@/lib/auth';

import { SignInScreen } from './sign-in-screen';

import type { ReactNode } from 'react';

interface AuthGateProps {
    children: ReactNode;
}

// The app is for whoever is signed in; everybody else gets the way to do so
const AuthGate = (props: AuthGateProps) => {
    const { children } = props;
    const t = useTranslations('auth');
    const { state } = useAuth();

    if (state.status === 'loading') {
        return (
            <p className="visually-hidden" role="status">
                {t('loading')}
            </p>
        );
    }
    if (state.status === 'signed-out') return <SignInScreen unreachable={state.unreachable} />;

    // Keyed by user, so another account starts with nothing of the previous one's state
    return (
        <UserProvider key={state.user.id} user={state.user}>
            {children}
        </UserProvider>
    );
};

export { AuthGate, type AuthGateProps };
