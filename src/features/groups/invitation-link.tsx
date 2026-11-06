import { useMemo, useState, type Ref } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { useLocale } from '@/lib/i18n';

import './invitation-link.css';

interface InvitationLinkProps {
    token: string;
    expiresAt: number;
    // Everything about a link needs a connection
    disabled: boolean;
    // While a change of the links is on its way
    busy: boolean;
    onRevoke: () => void;
    fieldRef?: Ref<HTMLInputElement>;
}

const canShare = () => typeof navigator.share === 'function';

// An open link of an invitation, in a field to copy it by hand, with the day it stops working. It is sent by the person
// themselves, as the app sends no message, and it is made before it is sent, as a share or a copy that waits for the
// network can be refused for want of a press of the person's own.
const InvitationLink = (props: InvitationLinkProps) => {
    const { token, expiresAt, disabled, busy, onRevoke, fieldRef } = props;
    const t = useTranslations('groups.invite');
    const { locale } = useLocale();
    const [sent, setSent] = useState<'copied' | 'failed' | null>(null);
    const dayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale]);
    const url = `${window.location.origin}/join/${token}`;

    const send = async () => {
        setSent(null);
        try {
            if (canShare()) {
                await navigator.share({ url });
            } else {
                await navigator.clipboard.writeText(url);
                setSent('copied');
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setSent('failed');
        }
    };

    return (
        <div className="invitation-link">
            <Field label={t('link')} hint={t('until', { date: dayFormat.format(new Date(expiresAt)) })}>
                {(control) => (
                    <input
                        {...control}
                        ref={fieldRef}
                        readOnly
                        type="text"
                        value={url}
                        onFocus={(event) => event.target.select()}
                    />
                )}
            </Field>
            <div className="invitation-link__actions">
                <Button ghost disabled={disabled} onClick={() => void send()}>
                    {canShare() ? t('share') : t('copy')}
                </Button>
                <Button ghost disabled={disabled || busy} onClick={onRevoke}>
                    {t('revoke')}
                </Button>
            </div>
            {sent === 'copied' && <Notice role="status">{t('copied')}</Notice>}
            {sent === 'failed' && (
                <Notice tone="danger" role="alert">
                    {t('sendFailed')}
                </Notice>
            )}
        </div>
    );
};

export { InvitationLink, type InvitationLinkProps };
