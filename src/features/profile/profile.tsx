import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { profileQuery } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { useOnline } from '@/lib/offline';
import { NICKNAME_MAX_LENGTH } from '@core/profile';

import { useProfileActions } from './use-profile-actions';

import './profile.css';

type Failure = 'saveFailed' | 'removeFailed';

// The nickname the person's friends see; changing it needs a connection
const Profile = () => {
    const t = useTranslations('settings.profile');
    const user = useUser();
    const online = useOnline();
    const { data: profile } = useQuery(profileQuery());
    const { save } = useProfileActions();

    const stored = profile?.nickname ?? null;
    // What the person typed, over the stored nickname until it is saved, so an answer that comes late never replaces it
    const [draft, setDraft] = useState<string | null>(null);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [busy, setBusy] = useState(false);
    const value = draft ?? stored ?? '';

    const send = async (nickname: string | null, onFailure: Failure) => {
        const sent = draft;
        setFailure(null);
        setBusy(true);
        try {
            await save(nickname);
            // What was typed while it was on its way stays
            setDraft((current) => (current === sent ? null : current));
        } catch {
            setFailure(onFailure);
        } finally {
            setBusy(false);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // An empty field takes the nickname away
        void send(value.trim() || null, 'saveFailed');
    };

    return (
        <section className="profile">
            <h2 className="profile__title">{t('title')}</h2>
            {!online && <Notice role="status">{t('offline')}</Notice>}
            <form className="profile__form" onSubmit={handleSubmit}>
                <Field label={t('label')} hint={t('hint', { name: profile?.name ?? user.name })}>
                    {(control) => (
                        <div className="profile__row">
                            <input
                                {...control}
                                className="profile__input"
                                autoComplete="nickname"
                                disabled={!online}
                                maxLength={NICKNAME_MAX_LENGTH}
                                type="text"
                                value={value}
                                onChange={(event) => setDraft(event.target.value)}
                            />
                            <Button disabled={!online || busy} type="submit">
                                {t('save')}
                            </Button>
                            {stored !== null && (
                                <Button disabled={!online || busy} onClick={() => void send(null, 'removeFailed')}>
                                    {t('remove')}
                                </Button>
                            )}
                        </div>
                    )}
                </Field>
                {failure && (
                    <Notice tone="danger" role="alert">
                        {t(failure)}
                    </Notice>
                )}
            </form>
        </section>
    );
};

export { Profile };
