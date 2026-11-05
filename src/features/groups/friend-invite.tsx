import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { friendInvitationQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { INVITATION_DAYS } from '@core/invitation';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { useGroupActions } from './use-group-actions';
import { useGroupWords } from './use-group-words';

import type { SharedGroup } from '@core/shared-group';

import './friend-invite.css';

interface FriendInviteProps {
    // A friend whose other side is a dummy
    group: SharedGroup;
    // Everything about the link needs a connection
    disabled: boolean;
}

// What went wrong: the server or the device refused the change, or the link couldn't be handed over
type InviteFailure = GroupFailure | 'sendFailed';

const canShare = () => typeof navigator.share === 'function';

// The link of an invitation for the dummy of a friend, made here and sent by the person themselves: the app sends no
// message. The open link is listed again, until it is used, revoked or expires.
const FriendInvite = (props: FriendInviteProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups.invite');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const online = useOnline();
    const { locale } = useLocale();
    const { invite, revokeInvitation } = useGroupActions();
    const invitation = useQuery(friendInvitationQuery(group.id));
    const [failure, setFailure] = useState<InviteFailure | null>(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const dayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale]);

    // The control that replaces the one pressed takes the focus
    const linkField = useRef<HTMLInputElement>(null);
    const makeButton = useRef<HTMLButtonElement>(null);
    const [focus, setFocus] = useState<'link' | 'make' | null>(null);
    useEffect(() => {
        if (focus === 'link') linkField.current?.focus();
        if (focus === 'make') makeButton.current?.focus();
    }, [focus, invitation.data]);

    const change = async (made: boolean) => {
        setFailure(null);
        setCopied(false);
        setBusy(true);
        try {
            await (made ? invite(group.id) : revokeInvitation(group.id));
            setFocus(made ? 'link' : 'make');
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setBusy(false);
        }
    };

    const send = async (url: string) => {
        setFailure(null);
        setCopied(false);
        try {
            if (canShare()) {
                await navigator.share({ url });
            } else {
                await navigator.clipboard.writeText(url);
                setCopied(true);
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setFailure('sendFailed');
        }
    };

    const open = invitation.data?.state === 'open' ? invitation.data : null;
    const url = open ? `${window.location.origin}/join/${open.token}` : null;

    return (
        <Sheet label={t('title')}>
            <p className="friend-invite__text">{t('hint', { name: words.title, days: INVITATION_DAYS })}</p>
            {open && url ? (
                <>
                    <Field label={t('link')} hint={t('until', { date: dayFormat.format(new Date(open.expiresAt)) })}>
                        {(control) => (
                            <input
                                {...control}
                                ref={linkField}
                                readOnly
                                type="text"
                                value={url}
                                onFocus={(event) => event.target.select()}
                            />
                        )}
                    </Field>
                    <div className="friend-invite__actions">
                        <Button ghost disabled={disabled} onClick={() => void send(url)}>
                            {canShare() ? t('share') : t('copy')}
                        </Button>
                        <Button ghost disabled={disabled || busy} onClick={() => void change(false)}>
                            {t('revoke')}
                        </Button>
                    </div>
                    {copied && <Notice role="status">{t('copied')}</Notice>}
                </>
            ) : (
                (invitation.data !== undefined || !online) && (
                    <>
                        {invitation.data?.state === 'declined' && <Notice role="status">{t('declined')}</Notice>}
                        <Button
                            ghost
                            ref={makeButton}
                            className="friend-invite__make"
                            disabled={disabled || busy}
                            onClick={() => void change(true)}
                        >
                            {invitation.data?.state === 'declined' ? t('makeAnother') : t('make')}
                        </Button>
                    </>
                )
            )}
            {invitation.isError && <Notice role="status">{t('loadFailed')}</Notice>}
            {failure && (
                <Notice tone="danger" role="alert">
                    {failure === 'sendFailed' ? t('sendFailed') : failureWords(failure)}
                </Notice>
            )}
        </Sheet>
    );
};

export { FriendInvite, type FriendInviteProps };
