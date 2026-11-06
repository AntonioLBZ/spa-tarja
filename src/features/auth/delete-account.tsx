import { useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { YOUR_DATA_ID } from '@/features/export/your-data';
import { ApiError, deleteAccount } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { useGroupOutbox, useOnline, useOutbox, useUserData } from '@/lib/offline';
import { EMAIL_MAX_LENGTH, confirmsEmail } from '@core/account';

import './delete-account.css';

type Phase = 'idle' | 'deleting' | 'failed' | 'wrong-email';

// Deletes the account for good, once the person has typed its email in the dialog. It needs a connection.
const DeleteAccount = () => {
    const t = useTranslations('settings.account.delete');
    const user = useUser();
    const online = useOnline();
    const { check, forget } = useAuth();
    const { discard } = useUserData();
    const outbox = useOutbox();
    const groupOutbox = useGroupOutbox();
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    // Set when the dialog closes to lead to Your data: the focus can only go there once it has closed
    const leaving = useRef(false);

    const deleting = phase === 'deleting';

    const start = () => {
        setTyped('');
        setPhase((current) => (current === 'deleting' ? current : 'idle'));
        setOpen(true);
    };

    const toYourData = () => {
        leaving.current = true;
        setOpen(false);
    };

    const handleClose = () => {
        setOpen(false);
        if (!leaving.current) return;
        leaving.current = false;
        const heading = document.getElementById(YOUR_DATA_ID);
        heading?.focus();
        heading?.scrollIntoView({ block: 'start' });
    };

    const handleDelete = async () => {
        setPhase('deleting');
        // Nothing of the user's is sent from now on, so no write lands after the account is gone
        outbox.pause();
        groupOutbox.pause();
        try {
            await deleteAccount(typed);
        } catch (error) {
            outbox.resume();
            groupOutbox.resume();
            // The email the server holds is not the one the device knows; the connection is not what failed
            const refused = error instanceof ApiError && error.status === 422 && error.code === 'wrong-email';
            setPhase(refused ? 'wrong-email' : 'failed');
            // A session that ended is asked again, as after any other 401
            if (error instanceof ApiError && error.status === 401) void check();
            return;
        }
        // The account is gone whatever happens here: the device signs out, and says so when its copy stays behind
        let cleared = true;
        try {
            await discard();
        } catch {
            cleared = false;
        }
        forget({ cleared });
    };

    const actions = (
        <>
            <Button
                ghost
                variant="danger"
                disabled={!online || deleting || !confirmsEmail(typed, user.email)}
                onClick={() => void handleDelete()}
            >
                {deleting ? t('deleting') : t('confirm')}
            </Button>
            <Button ghost disabled={deleting} onClick={() => setOpen(false)}>
                {t('cancel')}
            </Button>
        </>
    );

    return (
        <>
            {!online && <Notice role="status">{t('offline')}</Notice>}
            <Button block variant="danger" disabled={!online} onClick={start}>
                {t('open')}
            </Button>
            <Dialog open={open} title={t('title')} dismissible={!deleting} actions={actions} onClose={handleClose}>
                <p>{t('goes')}</p>
                <p>{t('stays')}</p>
                <p>{t('backups')}</p>
                <Button ghost className="delete-account__export" onClick={toYourData}>
                    {t('export')}
                </Button>
                <div className="delete-account__confirm">
                    <Field label={t('label')} hint={t('hint', { email: user.email })}>
                        {(control) => (
                            <input
                                {...control}
                                autoCapitalize="none"
                                autoComplete="off"
                                disabled={deleting}
                                maxLength={EMAIL_MAX_LENGTH}
                                spellCheck={false}
                                type="email"
                                value={typed}
                                onChange={(event) => setTyped(event.target.value)}
                            />
                        )}
                    </Field>
                </div>
                {!online && <Notice role="status">{t('offline')}</Notice>}
                {(phase === 'failed' || phase === 'wrong-email') && (
                    <Notice tone="danger" role="alert">
                        {phase === 'failed' ? t('failed') : t('wrongEmail')}
                    </Notice>
                )}
            </Dialog>
        </>
    );
};

export { DeleteAccount };
