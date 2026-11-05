import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { useOnline } from '@/lib/offline';
import { SHARED_NAME_MAX_LENGTH } from '@core/shared-group';

import { useFailureWords } from './group-failure';
import { useNewFriend } from './use-new-friend';

interface NewPersonProps {
    // Once the friend is made, with its group
    onMade: (groupId: string) => void;
}

// New person… of the add form: a friend made on the spot, by name. It sits in the form of the expense, so it has no
// form of its own, and Enter in its field makes the friend instead of adding the expense.
const NewPerson = (props: NewPersonProps) => {
    const { onMade } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const online = useOnline();
    const friend = useNewFriend();

    const make = async () => {
        const made = await friend.make();
        if (made) onMade(made.id);
    };

    return (
        <>
            <Field
                label={t('friend.name')}
                hint={online ? t('friend.nameHint') : t('share.newPersonOffline')}
                error={friend.invalid ? t('nameInvalid') : null}
            >
                {(control) => (
                    <input
                        {...control}
                        autoComplete="off"
                        disabled={!online}
                        maxLength={SHARED_NAME_MAX_LENGTH}
                        type="text"
                        value={friend.name}
                        onChange={(event) => friend.type(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            void make();
                        }}
                    />
                )}
            </Field>
            <Button block disabled={!online || friend.busy} onClick={() => void make()}>
                {t('friend.submit')}
            </Button>
            {friend.failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(friend.failure)}
                </Notice>
            )}
        </>
    );
};

export { NewPerson, type NewPersonProps };
