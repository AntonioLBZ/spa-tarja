import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { profileQuery } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/offline';
import { NICKNAME_MAX_LENGTH, nicknameSchema } from '@core/profile';
import { personName } from '@core/shared-group';

import { useProfileActions } from './use-profile-actions';

type Problem = 'invalid' | 'failed';

// Asks for the nickname right after a sign-in, when there is none; whether it asked is kept in memory only (ADR-0020)
const NicknamePrompt = () => {
    const t = useTranslations('nicknamePrompt');
    const online = useOnline();
    const { state } = useAuth();
    const fresh = state.status === 'signed-in' && state.fresh;
    const { data: profile } = useQuery(profileQuery());
    const { save } = useProfileActions();
    const formId = useId();
    const input = useRef<HTMLInputElement>(null);
    // Decided by the first profile read after the sign-in, so removing the nickname in Settings doesn't bring it up
    const [asking, setAsking] = useState<boolean | null>(null);
    const [typed, setTyped] = useState('');
    const [problem, setProblem] = useState<Problem | null>(null);
    const [busy, setBusy] = useState(false);

    if (profile && asking === null) setAsking(fresh && profile.nickname === null);
    if (!profile || profile.nickname !== null || !asking) return null;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(nicknameSchema, typed);
        if (!parsed.success) {
            setProblem('invalid');
            return;
        }
        setProblem(null);
        setBusy(true);
        try {
            // The saved nickname reaches the profile in the cache, and the prompt goes with it
            await save(parsed.output);
        } catch {
            setProblem('failed');
        } finally {
            setBusy(false);
        }
    };

    const actions = (
        <>
            <Button ghost disabled={!online || busy} form={formId} type="submit">
                {t('save')}
            </Button>
            <Button ghost disabled={busy} onClick={() => setAsking(false)}>
                {t('later')}
            </Button>
        </>
    );

    return (
        <Dialog
            open
            variant="sheet"
            title={t('title')}
            dismissible={!busy}
            initialFocus={() => input.current}
            actions={actions}
            onClose={() => setAsking(false)}
        >
            <form id={formId} onSubmit={(event) => void handleSubmit(event)}>
                <Field
                    label={t('label')}
                    hint={t('hint', { name: personName({ nickname: null, name: profile.name }) })}
                    error={problem === 'invalid' ? t('invalid') : null}
                >
                    {(control) => (
                        <input
                            {...control}
                            ref={input}
                            autoComplete="nickname"
                            disabled={busy}
                            maxLength={NICKNAME_MAX_LENGTH}
                            type="text"
                            value={typed}
                            onChange={(event) => {
                                setTyped(event.target.value);
                                if (problem === 'invalid') setProblem(null);
                            }}
                        />
                    )}
                </Field>
            </form>
            {!online && <Notice role="status">{t('offline')}</Notice>}
            {problem === 'failed' && (
                <Notice tone="danger" role="alert">
                    {t('failed')}
                </Notice>
            )}
        </Dialog>
    );
};

export { NicknamePrompt };
