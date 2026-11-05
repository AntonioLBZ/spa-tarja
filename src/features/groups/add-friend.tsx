import { useNavigate } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { SHARED_NAME_MAX_LENGTH } from '@core/shared-group';

import { useFailureWords } from './group-failure';
import { useNewFriend } from './use-new-friend';

import type { FormEvent } from 'react';

import './add-friend.css';

interface AddFriendProps {
    // Making a friend needs a connection
    disabled: boolean;
}

// A friend by name, opened once it is made, where the invitation can be sent
const AddFriend = (props: AddFriendProps) => {
    const { disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const navigate = useNavigate();
    const friend = useNewFriend();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const made = await friend.make();
        if (made) void navigate({ to: '/groups/$groupId', params: { groupId: made.id } });
    };

    return (
        <Disclosure summary={t('friend.title')} chevron keepMounted>
            <form className="add-friend" onSubmit={(event) => void handleSubmit(event)}>
                <Field
                    label={t('friend.name')}
                    hint={t('friend.nameHint')}
                    error={friend.invalid ? t('nameInvalid') : null}
                >
                    {(control) => (
                        <input
                            {...control}
                            autoComplete="off"
                            disabled={disabled}
                            maxLength={SHARED_NAME_MAX_LENGTH}
                            type="text"
                            value={friend.name}
                            onChange={(event) => friend.type(event.target.value)}
                        />
                    )}
                </Field>
                <Button block variant="primary" disabled={disabled || friend.busy} type="submit">
                    {t('friend.submit')}
                </Button>
                {friend.failure && (
                    <Notice tone="danger" role="alert">
                        {failureWords(friend.failure)}
                    </Notice>
                )}
            </form>
        </Disclosure>
    );
};

export { AddFriend, type AddFriendProps };
