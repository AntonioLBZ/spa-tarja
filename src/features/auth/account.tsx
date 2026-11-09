import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { useAuth, useUser } from '@/lib/auth';
import { useGroupOutbox, useOutbox } from '@/lib/offline';

import { DeleteAccount } from './delete-account';
import { PrivacyNotice } from './privacy-notice';

import './account.css';

const Account = () => {
    const t = useTranslations('settings.account');
    const user = useUser();
    const { signOut } = useAuth();
    const outbox = useOutbox();
    const groupOutbox = useGroupOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const { pending: pendingEntries } = useSyncExternalStore(groupOutbox.subscribe, groupOutbox.getState);
    const [phase, setPhase] = useState<'idle' | 'signing-out' | 'failed'>('idle');

    const handleSignOut = async () => {
        setPhase('signing-out');
        try {
            await signOut();
        } catch {
            setPhase('failed');
        }
    };

    return (
        <section className="account">
            <h2 className="account__title">{t('title')}</h2>
            <p className="account__user">
                <span className="account__name">{user.name}</span>
                <span className="account__email">{user.email}</span>
            </p>
            {pending.length + pendingEntries.length > 0 && <Notice>{t('unsynced')}</Notice>}
            {phase === 'failed' && (
                <Notice tone="danger" role="alert">
                    {t('signOutFailed')}
                </Notice>
            )}
            <Button block disabled={phase === 'signing-out'} onClick={handleSignOut}>
                {phase === 'signing-out' ? t('signingOut') : t('signOut')}
            </Button>
            <DeleteAccount />
            <PrivacyNotice />
        </section>
    );
};

export { Account };
