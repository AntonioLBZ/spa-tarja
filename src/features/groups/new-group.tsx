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
    const [personInvalid, setPersonInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);
    // The person makes the group, so the rest are one fewer than the most a group takes
    const full = people.length >= MAX_GROUP_MEMBERS - 1;

    const addPerson = () => {
        const parsed = v.safeParse(sharedNameSchema, person);
        if (!parsed.success) {
            setPersonInvalid(true);
            return;
        }
        setPeople((current) => [...current, { id: crypto.randomUUID(), name: parsed.output }]);
        setPerson('');
    };

    // Enter adds the person instead of making the group
    const handlePersonKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (!full) addPerson();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(sharedNameSchema, name);
        if (!parsed.success) {
            setNameInvalid(true);
            return;
        }

        setFailure(null);
        setBusy(true);
        try {
            const group = await createGroup({ id: ids.group, name: parsed.output, me: ids.me, others: people });
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
                    error={personInvalid ? t('nameInvalid') : null}
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
                                    setPersonInvalid(false);
                                }}
                                onKeyDown={handlePersonKey}
                            />
                            <Button disabled={disabled || full} onClick={addPerson}>
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
