import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { MAX_GROUP_MEMBERS, SHARED_NAME_MAX_LENGTH, sharedNameSchema } from '@core/shared-group';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { useGroupActions, type Placeholder } from './use-group-actions';

import './new-group.css';

interface NewGroupProps {
    // Making a group needs a connection
    disabled: boolean;
}

// The name of a group, and the people added to it by name, one at a time. The ids are made once and kept while the
// screen is open, so a group sent again after an answer that never came is the same group.
const NewGroup = (props: NewGroupProps) => {
    const { disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const navigate = useNavigate();
    const { createGroup } = useGroupActions();
    const [ids] = useState(() => ({ group: crypto.randomUUID(), me: crypto.randomUUID() }));

    const [name, setName] = useState('');
    const [person, setPerson] = useState('');
    const [people, setPeople] = useState<Placeholder[]>([]);
    const [nameInvalid, setNameInvalid] = useState(false);
    // Why the person typed can't be added: a name with nothing that shows, or a group with no room left
    const [personError, setPersonError] = useState<'invalid' | 'full' | null>(null);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    // The people with the one in the field added, or null when it can't be, and the field then says why. The person
    // makes the group, so the rest are one fewer than the most a group takes.
    const withTyped = (): Placeholder[] | null => {
        const parsed = v.safeParse(sharedNameSchema, person);
        if (!parsed.success) {
            setPersonError('invalid');
            return null;
        }
        if (people.length >= MAX_GROUP_MEMBERS - 1) {
            setPersonError('full');
            return null;
        }
        const added = [...people, { id: crypto.randomUUID(), name: parsed.output }];
        setPeople(added);
        setPerson('');
        return added;
    };

    // Enter adds the person instead of making the group
    const handlePersonKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        withTyped();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(sharedNameSchema, name);
        if (!parsed.success) {
            setNameInvalid(true);
            return;
        }
        // A person typed and never added goes in with the rest
        const others = person.trim() ? withTyped() : people;
        if (!others) return;

        setFailure(null);
        setBusy(true);
        try {
            const group = await createGroup({ id: ids.group, name: parsed.output, me: ids.me, others });
            void navigate({ to: '/groups/$groupId', params: { groupId: group.id } });
        } catch (error) {
            setFailure(failureOf(error));
            setBusy(false);
        }
    };

    return (
        <Disclosure summary={t('new.title')} chevron keepMounted>
            <form className="new-group" onSubmit={(event) => void handleSubmit(event)}>
                <Field label={t('new.name')} error={nameInvalid ? t('nameInvalid') : null}>
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
                                setNameInvalid(false);
                            }}
                        />
                    )}
                </Field>
                <Field
                    label={t('new.person')}
                    hint={t('new.personHint')}
                    error={
                        personError === 'invalid'
                            ? t('nameInvalid')
                            : personError === 'full' && t('new.full', { max: MAX_GROUP_MEMBERS })
                    }
                >
                    {(control) => (
                        <div className="new-group__row">
                            <input
                                {...control}
                                className="new-group__input"
                                autoComplete="off"
                                disabled={disabled}
                                maxLength={SHARED_NAME_MAX_LENGTH}
                                type="text"
                                value={person}
                                onChange={(event) => {
                                    setPerson(event.target.value);
                                    setPersonError(null);
                                }}
                                onKeyDown={handlePersonKey}
                            />
                            <Button disabled={disabled} onClick={() => withTyped()}>
                                {t('new.add')}
                            </Button>
                        </div>
                    )}
                </Field>
                {people.length > 0 && (
                    <CardList label={t('new.people')}>
                        {people.map((added) => (
                            <Card as="li" className="new-group__person" key={added.id}>
                                <span className="new-group__name">{added.name}</span>
                                <Button
                                    ghost
                                    aria-label={t('new.removeItem', { name: added.name })}
                                    disabled={disabled}
                                    onClick={() => setPeople((current) => current.filter((item) => item !== added))}
                                >
                                    {t('new.remove')}
                                </Button>
                            </Card>
                        ))}
                    </CardList>
                )}
                <Button block variant="primary" disabled={disabled || busy} type="submit">
                    {t('new.submit')}
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

export { NewGroup, type NewGroupProps };
