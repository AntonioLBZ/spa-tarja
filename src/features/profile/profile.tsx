import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { profileQuery } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { useOnline } from '@/lib/offline';
import { NICKNAME_MAX_LENGTH, nicknameSchema } from '@core/profile';

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
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [busy, setBusy] = useState(false);
    const value = draft ?? stored ?? '';

    const send = async (nickname: string | null, onFailure: Failure) => {
        const sent = draft;
        setInvalid(false);
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
        const typed = value.trim();
        if (typed && !v.is(nicknameSchema, typed)) {
            setInvalid(true);
            return;
        }
        // An empty field takes the nickname away
        void send(typed || null, 'saveFailed');
    };

    return (
        <section className="profile">
            <h2 className="profile__title">{t('title')}</h2>
            {!online && <Notice role="status">{t('offline')}</Notice>}
            <form className="profile__form" onSubmit={handleSubmit}>
                <Field
                    label={t('label')}
                    hint={t('hint', { name: profile?.name ?? user.name })}
                    error={invalid ? t('invalid') : null}
                >
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
                                onChange={(event) => {
                                    setDraft(event.target.value);
                                    setInvalid(false);
                                }}
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
