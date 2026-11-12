import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'use-intl';

import { Brand } from '@/components/brand/brand';
import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { invitationPath, useAuth, type DeletedAccount } from '@/lib/auth';
import { MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';
import { isPrerelease } from '@/lib/prerelease';

import { PrivacyNotice } from './privacy-notice';

import './sign-in-screen.css';

type Phase = 'idle' | 'opening' | 'failed';

// The comb under the name: a month of days that were spent differently, drawn once and the same every time
const TICKS = [
    0.3, 0.55, 0.2, 0.8, 0.4, 0.15, 0.65, 0.95, 0.35, 0.5, 0.25, 0.7, 0.45, 0.85, 0.3, 0.6, 0.2, 0.75, 0.4, 0.55,
];

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

    useGSAP(
        () => {
            const main = root.current;
            if (!main || !canAnimate()) return;
            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                const timeline = gsap.timeline({ defaults: { ease: 'expo.out' } });
                timeline
                    .from(main.querySelector('.brand'), { y: 40, opacity: 0, duration: 1 })
                    .from(
                        main.querySelectorAll('.sign-in__tick'),
                        { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, stagger: 0.025, ease: 'back.out(2)' },
                        0.2
                    )
                    .from(
                        main.querySelector('.sign-in__sheet'),
                        { y: 80, duration: 0.9, clearProps: 'transform' },
                        0.1
                    );
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
            <div className="sign-in__field">
                <div data-enter>
                    <Brand size="hero" prerelease={isPrerelease()} />
                </div>
                <div className="sign-in__ticks" aria-hidden="true" data-enter>
                    {TICKS.map((rise, index) => (
                        <span key={index} className="sign-in__tick" style={{ '--rise': rise } as CSSProperties} />
                    ))}
                </div>
            </div>
            <div className="sign-in__sheet perforated">
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
                <Button variant="primary" block disabled={phase === 'opening'} onClick={start}>
                    {phase === 'opening' ? t('opening') : t('google')}
                </Button>
                <p className="sign-in__summary">{t('privacy')}</p>
                <div className="sign-in__privacy">
                    <PrivacyNotice />
                </div>
            </div>
        </main>
    );
};

export { SignInScreen, type SignInScreenProps };
