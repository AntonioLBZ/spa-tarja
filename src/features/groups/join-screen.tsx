import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { ButtonLink } from '@/components/button/button-link';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { ApiError, invitationQuery } from '@/lib/api';
import { useOnline } from '@/lib/offline';

import { useFailureWords } from './group-failure';
import { LocalRefusal } from './local-refusal';
import { useGroupActions } from './use-group-actions';

import './join-screen.css';

interface JoinScreenProps {
    token: string;
}

// Why the page has nothing left to offer but the way to Groups: the link can't be used, it is the person's own, or
// they declined it
type LinkEnd = 'gone' | 'yourself' | 'declined';

// Why accepting or declining didn't go through, while the link can still be answered
type AnswerFailure =
    'alreadyFriends' | 'tooManyFriends' | 'tooManyClosedGroups' | 'inviterAtLimit' | 'offline' | 'failed';

const ANSWER_FAILURES: Partial<Record<string, AnswerFailure>> = {
    'already-friends': 'alreadyFriends',
    'too-many-friends': 'tooManyFriends',
    'too-many-closed-groups': 'tooManyClosedGroups',
    'inviter-at-limit': 'inviterAtLimit',
};

const endOf = (error: unknown): LinkEnd | null => {
    if (!(error instanceof ApiError)) return null;
    if (error.code === 'gone') return 'gone';
    return error.code === 'yourself' ? 'yourself' : null;
};

const answerFailureOf = (error: unknown): AnswerFailure => {
    if (error instanceof LocalRefusal) return 'offline';
    return (error instanceof ApiError && error.code !== null && ANSWER_FAILURES[error.code]) || 'failed';
};

// The page a link to be friends opens: who asks, what accepting does, and Accept or Decline. Accepting opens the friend.
// A link for a dummy also hands the person what was shared with it.
const JoinScreen = (props: JoinScreenProps) => {
    const { token } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const online = useOnline();
    const navigate = useNavigate();
    const { acceptLink, declineLink } = useGroupActions();
    const link = useQuery(invitationQuery(token));
    const [answered, setAnswered] = useState<LinkEnd | null>(null);
    const [failure, setFailure] = useState<AnswerFailure | null>(null);
    const [busy, setBusy] = useState(false);
    const end = answered ?? endOf(link.error);

    const answer = async (accept: boolean) => {
        setFailure(null);
        setBusy(true);
        try {
            if (accept) {
                const friend = await acceptLink(token);
                void navigate({ to: '/groups/$groupId', params: { groupId: friend.id }, replace: true });
            } else {
                await declineLink(token);
                setAnswered('declined');
            }
        } catch (error) {
            const reason = endOf(error);
            if (reason) setAnswered(reason);
            else setFailure(answerFailureOf(error));
        } finally {
            setBusy(false);
        }
    };

    const failureText = (reason: AnswerFailure, name: string) => {
        if (reason === 'alreadyFriends' || reason === 'inviterAtLimit') return t(`join.${reason}`, { name });
        return reason === 'failed' ? t('join.failed') : failureWords(reason);
    };

    const content = () => {
        if (end) {
            return (
                <>
                    <Notice role="status">{t(`join.${end}`)}</Notice>
                    <ButtonLink block to="/groups">
                        {t('group.back')}
                    </ButtonLink>
                </>
            );
        }
        if (link.data) {
            const { name, forDummy } = link.data;
            return (
                <>
                    <Sheet label={name}>
                        <p className="join__text">{t('join.asks', { name })}</p>
                        <p className="join__text">{t(forDummy ? 'join.what' : 'join.whatNew', { name })}</p>
                        <div className="join__actions">
                            <Button ghost disabled={!online || busy} onClick={() => void answer(true)}>
                                {t('join.accept')}
                            </Button>
                            <Button ghost disabled={!online || busy} onClick={() => void answer(false)}>
                                {t('join.decline')}
                            </Button>
                        </div>
                    </Sheet>
                    {failure && (
                        <Notice tone="danger" role="alert">
                            {failureText(failure, name)}
                        </Notice>
                    )}
                </>
            );
        }
        if (link.isError) {
            return (
                <>
                    <Notice tone="danger" role="alert">
                        {t('join.loadFailed')}
                    </Notice>
                    <Button block disabled={!online} onClick={() => void link.refetch()}>
                        {t('join.retry')}
                    </Button>
                </>
            );
        }
        return online && <p role="status">{t('join.loading')}</p>;
    };

    return (
        <section className="join">
            <h1 className="join__title">{t('join.title')}</h1>
            {!online && !end && <Notice role="status">{t('join.offline')}</Notice>}
            {content()}
        </section>
    );
};

export { JoinScreen, type JoinScreenProps };
