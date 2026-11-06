import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { GROUPS_KEY, friendInvitationQuery } from '@/lib/api';
import { useOnline } from '@/lib/offline';
import { INVITATION_DAYS } from '@core/invitation';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { InvitationLink } from './invitation-link';
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

// The link of an invitation for the dummy of a friend, made here. The open link is listed again, until it is used,
// revoked or expires.
const FriendInvite = (props: FriendInviteProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups.invite');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const online = useOnline();
    const { invite, revokeInvitation } = useGroupActions();
    const queryClient = useQueryClient();
    const invitation = useQuery(friendInvitationQuery(group.id));
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    // No invitation for a friend that looks invitable: the other side may have taken its place since the groups were read
    useEffect(() => {
        if (invitation.data === null) void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    }, [invitation.data, invitation.dataUpdatedAt, queryClient]);

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

    const open = invitation.data?.state === 'open' ? invitation.data : null;

    return (
        <Sheet label={t('title')}>
            <p className="friend-invite__text">{t('hint', { name: words.title, days: INVITATION_DAYS })}</p>
            {open ? (
                <InvitationLink
                    key={open.token}
                    token={open.token}
                    expiresAt={open.expiresAt}
                    disabled={disabled}
                    busy={busy}
                    fieldRef={linkField}
                    onRevoke={() => void change(false)}
                />
            ) : (
                (invitation.data !== undefined || invitation.isError || !online) && (
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
                    {failureWords(failure)}
                </Notice>
            )}
        </Sheet>
    );
};

export { FriendInvite, type FriendInviteProps };
