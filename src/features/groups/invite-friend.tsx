import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { pendingInvitationsQuery } from '@/lib/api';
import { INVITATION_DAYS } from '@core/invitation';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { InvitationLink } from './invitation-link';
import { useGroupActions } from './use-group-actions';

import './invite-friend.css';

interface InviteFriendProps {
    // Making and revoking a link needs a connection
    disabled: boolean;
}

// What takes the focus once a change of the links is done
type Focus = { on: 'invite' } | { on: 'link'; id: string };

// A friend who uses the app is invited with a link made at once, with nobody behind it (ADR-0014), and the links of the
// person that are still open are listed under it, to send or revoke
const InviteFriend = (props: InviteFriendProps) => {
    const { disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const { inviteFriend, revokeLink } = useGroupActions();
    const links = useQuery(pendingInvitationsQuery());
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    // A new link takes the focus once it is listed, and Invite a friend takes it back once a link is revoked
    const inviteButton = useRef<HTMLButtonElement>(null);
    const newField = useRef<HTMLInputElement>(null);
    const [focus, setFocus] = useState<Focus | null>(null);
    useEffect(() => {
        const target = focus?.on === 'invite' ? inviteButton.current : focus ? newField.current : null;
        if (!target) return;
        target.focus();
        setFocus(null);
    }, [focus, links.data]);

    const change = async (run: () => Promise<Focus>) => {
        setFailure(null);
        setBusy(true);
        try {
            setFocus(await run());
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setBusy(false);
        }
    };

    const make = () => change(async () => ({ on: 'link', id: (await inviteFriend()).id }));

    const revoke = (id: string) =>
        change(async () => {
            await revokeLink(id);
            return { on: 'invite' };
        });

    return (
        <div className="invite-friend">
            <div className="invite-friend__start">
                <Button
                    ref={inviteButton}
                    block
                    variant="primary"
                    disabled={disabled || busy}
                    onClick={() => void make()}
                >
                    {t('links.make')}
                </Button>
                <p className="invite-friend__hint">{t('links.hint', { days: INVITATION_DAYS })}</p>
            </div>
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
            {links.data && links.data.length > 0 && (
                <Sheet label={t('links.title')}>
                    {links.data.map((link) => (
                        <InvitationLink
                            key={link.id}
                            token={link.token}
                            expiresAt={link.expiresAt}
                            disabled={disabled}
                            busy={busy}
                            fieldRef={focus?.on === 'link' && focus.id === link.id ? newField : undefined}
                            onRevoke={() => void revoke(link.id)}
                        />
                    ))}
                </Sheet>
            )}
            {links.isError && <Notice role="status">{t('links.loadFailed')}</Notice>}
        </div>
    );
};

export { InviteFriend, type InviteFriendProps };
