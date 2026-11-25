import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { failureOf, useFailureWords, type GroupFailure } from '@/features/groups/data/group-failure';
import { useGroupActions } from '@/features/groups/data/use-group-actions';
import { ListSection } from '@/features/groups/list/list-section';
import { pendingInvitationsQuery } from '@/lib/api';
import { INVITATION_DAYS } from '@core/invitation';

import { InvitationLink } from './invitation-link';

import './invite-friend.css';

interface InviteFriendProps {
    title: string;
    // Making and revoking a link needs a connection
    disabled: boolean;
    // The friends, under the links
    children: ReactNode;
}

// What takes the focus once a change of the links is done
type Focus = { on: 'invite' } | { on: 'link'; id: string };

// The section of the friends: a friend who uses the app is invited with a link made at once, with nobody behind it
// (ADR-0014), from the heading (ADR-0038), and the links of the person that are still open are listed under it, to send
// or revoke, before the friends
const InviteFriend = (props: InviteFriendProps) => {
    const { title, disabled, children } = props;
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
        <ListSection
            title={title}
            action={
                <Button
                    ref={inviteButton}
                    ghost
                    className="list-section__action"
                    aria-label={t('links.make')}
                    disabled={disabled || busy}
                    onClick={() => void make()}
                >
                    <Icon name="add" />
                    {t('links.makeShort')}
                </Button>
            }
        >
            <p className="hint invite-friend__hint">{t('links.hint', { days: INVITATION_DAYS })}</p>
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
            {links.data && links.data.length > 0 && (
                <Sheet label={t('links.title')} level="h3">
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
            <LiveNotice>{links.isError && t('links.loadFailed')}</LiveNotice>
            {children}
        </ListSection>
    );
};

export { InviteFriend, type InviteFriendProps };
