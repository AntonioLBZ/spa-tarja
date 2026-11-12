import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Brand } from '@/components/brand/brand';
import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { TallyMark } from '@/components/tally-mark/tally-mark';
import { invitationPath, useAuth, type DeletedAccount } from '@/lib/auth';
import { DURATION, EASE, MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';
import { isPrerelease } from '@/lib/prerelease';

import { PrivacyNotice } from './privacy-notice';

import './sign-in-screen.css';

type Phase = 'idle' | 'opening' | 'failed';

// Google sends the person back with `?signin=failed` when the sign-in didn't go through
const cameBackFailed = (): boolean => {
    return new URLSearchParams(window.location.search).get('signin') === 'failed';
};

interface SignInScreenProps {
    unreachable: boolean;
    // The account was just deleted from this device
    deleted: DeletedAccount | null;
}

const SignInScreen = (props: SignInScreenProps) => {
    const { unreachable, deleted } = props;
    const t = useTranslations('auth');
    const { signIn } = useAuth();
    const [phase, setPhase] = useState<Phase>(() => (cameBackFailed() ? 'failed' : 'idle'));
    const root = useRef<HTMLElement>(null);

    // What is under the logo rises in one line after the other
    useGSAP(
        () => {
            const lines = root.current?.querySelectorAll('.sign-in > :not(.brand, .tally-mark)');
            if (!lines?.length || !canAnimate()) return;
            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                gsap.from(lines, {
                    y: 18,
                    opacity: 0,
                    duration: DURATION.slow * 1.6,
                    ease: EASE.enter,
                    stagger: 0.08,
                    delay: 0.25,
                    clearProps: 'transform,opacity',
                });
            });
            return () => mm.revert();
        },
        { scope: root }
    );

    // Coming back to the page from Google with the back button restores it as it was left
    useEffect(() => {
        const reset = (event: PageTransitionEvent) => {
            if (event.persisted) setPhase('idle');
        };
        window.addEventListener('pageshow', reset);
        return () => window.removeEventListener('pageshow', reset);
    }, []);

    const start = async () => {
        setPhase('opening');
        try {
            await signIn();
        } catch {
            setPhase('failed');
        }
    };

    return (
        <main ref={root} className="sign-in">
            <Brand size="hero" prerelease={isPrerelease()} />
            <TallyMark />
            <h1 className="sign-in__title">{t('title')}</h1>
            <p className="sign-in__description">{t('description')}</p>
            {deleted?.cleared === true && <Notice role="alert">{t('deleted')}</Notice>}
            {deleted?.cleared === false && (
                <Notice tone="danger" role="alert">
                    {t('deletedNotCleared')}
                </Notice>
            )}
            {invitationPath(window.location.pathname) && <Notice>{t('invited')}</Notice>}
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
            <Button disabled={phase === 'opening'} onClick={start}>
                {phase === 'opening' ? t('opening') : t('google')}
            </Button>
            <p className="sign-in__summary">{t('privacy')}</p>
            <div className="sign-in__privacy">
                <PrivacyNotice />
            </div>
        </main>
    );
};

export { SignInScreen, type SignInScreenProps };
