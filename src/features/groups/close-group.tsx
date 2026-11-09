import { useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { ButtonLink } from '@/components/button/button-link';
import { Notice } from '@/components/notice/notice';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { isOwner } from './is-owner';
import { mayDelete } from './may-delete';
import { myBalance } from './my-balance';
import { useGroupActions } from './use-group-actions';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';

import './close-group.css';

interface CloseGroupProps {
    ledger: Ledger;
    // Nothing can change without a connection
    disabled: boolean;
}

// How the person closes a group: a member leaves it, the owner deletes it, and either side of a friend removes it
type Way = 'leave' | 'delete' | 'deleteFriend';

// What the panel says in place of the button: the question, or that a balance has to be settled first
type Asking = 'question' | 'unsettled';

// The last section of the settings of an open group. It asks before it closes the group, and once it has, it goes back
// to Groups, where the group is among the closed ones.
const CloseGroup = (props: CloseGroupProps) => {
    const { ledger, disabled } = props;
    const { group, entries, hasData } = ledger;
    const t = useTranslations('groups.close');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const navigate = useNavigate();
    const { leave, remove } = useGroupActions();
    const [asking, setAsking] = useState<Asking | null>(null);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);
    const textId = useId();

    const way: Way = group.kind === 'direct' ? 'deleteFriend' : isOwner(group) ? 'delete' : 'leave';
    // As the device sees it; a ledger never pulled asks, and the server decides
    const settled = !hasData || (way === 'leave' ? myBalance(group, entries) === 0 : mayDelete(group, entries));

    // The panel replaces the button, so the focus is handed on by hand: to Cancel, and back to the button after it
    const button = useRef<HTMLButtonElement>(null);
    const cancel = useRef<HTMLButtonElement>(null);
    const wasAsking = useRef(false);
    useEffect(() => {
        if (asking) cancel.current?.focus();
        else if (wasAsking.current) button.current?.focus();
        wasAsking.current = asking !== null;
    }, [asking]);

    const ask = (next: Asking | null) => {
        setAsking(next);
        setFailure(null);
    };

    const handleConfirm = async () => {
        setFailure(null);
        setBusy(true);
        try {
            await (way === 'leave' ? leave(group.id) : remove(group.id));
            void navigate({ to: '/groups' });
        } catch (error) {
            const reason = failureOf(error);
            if (reason === 'unsettled') setAsking('unsettled');
            else setFailure(reason);
            setBusy(false);
        }
    };

    return (
        <div className="close-group">
            {asking === null ? (
                <Button
                    block
                    ref={button}
                    variant="danger"
                    disabled={disabled}
                    onClick={() => ask(settled ? 'question' : 'unsettled')}
                >
                    {t(`${way}.button`)}
                </Button>
            ) : (
                <>
                    {asking === 'question' ? (
                        <>
                            <p id={textId} className="close-group__text">
                                {t(`${way}.question`, { name: words.title })}
                            </p>
                            <p className="close-group__text">{t(`${way}.what`)}</p>
                        </>
                    ) : (
                        <p id={textId} className="close-group__text">
                            {t(`${way}.unsettled`, { name: words.title })}
                        </p>
                    )}
                    <div className="close-group__actions">
                        {asking === 'question' ? (
                            <Button
                                ghost
                                variant="danger"
                                disabled={disabled || busy}
                                onClick={() => void handleConfirm()}
                            >
                                {t(`${way}.confirm`)}
                            </Button>
                        ) : (
                            <ButtonLink ghost to="/groups/$groupId" params={{ groupId: group.id }}>
                                {t('settleUp')}
                            </ButtonLink>
                        )}
                        <Button ghost ref={cancel} aria-describedby={textId} onClick={() => ask(null)}>
                            {t('cancel')}
                        </Button>
                    </div>
                </>
            )}
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
        </div>
    );
};

export { CloseGroup, type CloseGroupProps };
