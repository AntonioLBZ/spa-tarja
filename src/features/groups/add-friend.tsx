import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema } from '@core/shared-group';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { useGroupActions } from './use-group-actions';

import './add-friend.css';

interface AddFriendProps {
    // Making a friend needs a connection
    disabled: boolean;
}

// A friend by name: a group of two, the person and a dummy they can invite later (ADR-0014). The ids are made once and
// kept while the screen is open, so a friend sent again after an answer that never came is the same friend.
const AddFriend = (props: AddFriendProps) => {
    const { disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const navigate = useNavigate();
    const { createFriend, savePerson } = useGroupActions();
    const [ids] = useState(() => ({ group: crypto.randomUUID(), me: crypto.randomUUID(), other: crypto.randomUUID() }));
    const [name, setName] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(sharedNameSchema, name);
        if (!parsed.success) {
            setInvalid(true);
            return;
        }

        setFailure(null);
        setBusy(true);
        try {
            const friend = await createFriend({
                id: ids.group,
                me: ids.me,
                other: { id: ids.other, name: parsed.output },
            });
            // Made by a send whose answer was lost, it has the name typed then
            const other = friend.members.find((member) => member.id === ids.other);
            if (other && !other.claimed && other.name !== parsed.output) {
                await savePerson(friend.id, ids.other, parsed.output);
            }
            void navigate({ to: '/groups/$groupId', params: { groupId: friend.id } });
        } catch (error) {
            setFailure(failureOf(error));
            setBusy(false);
        }
    };

    return (
        <Disclosure summary={t('friend.title')} chevron keepMounted>
            <form className="add-friend" onSubmit={(event) => void handleSubmit(event)}>
                <Field label={t('friend.name')} hint={t('friend.nameHint')} error={invalid ? t('nameInvalid') : null}>
                    {(control) => (
                        <input
                            {...control}
                            autoComplete="off"
                            disabled={disabled}
                            maxLength={SHARED_NAME_MAX_LENGTH}
                            type="text"
                            value={name}
                            onChange={(event) => {
                                setName(event.target.value);
                                setInvalid(false);
                            }}
                        />
                    )}
                </Field>
                <Button block variant="primary" disabled={disabled || busy} type="submit">
                    {t('friend.submit')}
                </Button>
                {failure && (
                    <Notice tone="danger" role="alert">
                        {failureWords(failure)}
                    </Notice>
                )}
            </form>
        </Disclosure>
    );
};

export { AddFriend, type AddFriendProps };
