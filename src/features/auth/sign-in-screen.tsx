import { useEffect, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Brand } from '@/components/brand/brand';
import { Notice } from '@/components/notice/notice';
import { useAuth } from '@/lib/auth';

import './sign-in-screen.css';

type Phase = 'idle' | 'opening' | 'failed';

// Google sends the person back to `/?signin=failed` when the sign-in didn't go through
function cameBackFailed(): boolean {
    return new URLSearchParams(window.location.search).get('signin') === 'failed';
}

function SignInScreen(props: { unreachable: boolean }) {
    const { unreachable } = props;
    const t = useTranslations('auth');
    const { signIn } = useAuth();
    const [phase, setPhase] = useState<Phase>(() => (cameBackFailed() ? 'failed' : 'idle'));

    // Coming back to the page from Google with the back button restores it as it was left
    useEffect(() => {
        const reset = (event: PageTransitionEvent) => {
            if (event.persisted) setPhase('idle');
        };
        window.addEventListener('pageshow', reset);
        return () => window.removeEventListener('pageshow', reset);
    }, []);

    async function start() {
        setPhase('opening');
        try {
            await signIn();
        } catch {
            setPhase('failed');
        }
    }

    return (
        <main className="sign-in">
            <Brand size="hero" />
            <h1 className="sign-in__title">{t('title')}</h1>
            <p className="sign-in__description">{t('description')}</p>
            {unreachable && (
                <Notice tone="danger" role="alert">
                    {t('unreachable')}
                </Notice>
            )}
            {phase === 'failed' && (
                <Notice tone="danger" role="alert">
                    {t('failed')}
                </Notice>
            )}
            <button type="button" disabled={phase === 'opening'} onClick={start}>
                {phase === 'opening' ? t('opening') : t('google')}
            </button>
        </main>
    );
}

export { SignInScreen };
