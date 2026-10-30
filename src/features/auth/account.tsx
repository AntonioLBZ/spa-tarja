import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { useAuth, useUser } from '@/lib/auth';
import { useOutbox, useUserData } from '@/lib/offline';

import './account.css';

const Account = () => {
    const t = useTranslations('settings.account');
    const user = useUser();
    const { signOut } = useAuth();
    const { discard } = useUserData();
    const outbox = useOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const [phase, setPhase] = useState<'idle' | 'signing-out' | 'failed'>('idle');

    const handleSignOut = async () => {
        setPhase('signing-out');
        try {
            await signOut();
        } catch {
            setPhase('failed');
            return;
        }
        // What hasn't synced stays on the device for the next time this user signs in
        await outbox.ready;
        if (outbox.getState().pending.length === 0) await discard();
    };

    return (
        <section className="account">
            <h2 className="account__title">{t('title')}</h2>
            <p className="account__user">
                <span className="account__name">{user.name}</span>
                <span className="account__email">{user.email}</span>
            </p>
            {pending.length > 0 && <Notice>{t('unsynced')}</Notice>}
            {phase === 'failed' && (
                <Notice tone="danger" role="alert">
                    {t('signOutFailed')}
                </Notice>
            )}
            <Button disabled={phase === 'signing-out'} onClick={handleSignOut}>
                {phase === 'signing-out' ? t('signingOut') : t('signOut')}
            </Button>
        </section>
    );
};

export { Account };
