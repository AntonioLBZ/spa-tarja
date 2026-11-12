import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { MAX_GROUP_MEMBERS, SHARED_NAME_MAX_LENGTH, sharedNameSchema, type SharedGroup } from '@core/shared-group';

import { failureOf, failureOfFriend, useFailureWords, type GroupFailure } from './group-failure';
import { useFriends } from './use-friends';
import { useGroupActions } from './use-group-actions';

import './new-group.css';

interface NewGroupProps {
    // Making a group needs a connection
    disabled: boolean;
}

// Somebody to add: a dummy by name, or one of the person's friends, named by the id of that friend. `id` is the member
// they will be, made when they are listed and kept while the screen is open.
interface Person {
    id: string;
    name: string;
    friend?: string;
}

// The name of a group and its people, added one at a time: dummies by name and friends. The ids are made
// once and kept while the screen is open, so a group sent again after an answer that never came is the same group.
const NewGroup = (props: NewGroupProps) => {
    const { disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const navigate = useNavigate();
    const { createGroup, savePerson, addFriend, removeMember } = useGroupActions();
    const friends = useFriends();
    const [ids] = useState(() => ({ group: crypto.randomUUID(), me: crypto.randomUUID() }));

    const [name, setName] = useState('');
    const [person, setPerson] = useState('');
    // The friend chosen in the list, or '' for none
    const [friend, setFriend] = useState('');
    const [people, setPeople] = useState<Person[]>([]);
    const [nameInvalid, setNameInvalid] = useState(false);
    // Why the person typed can't be added: a name with nothing that shows, or a group with no room left
    const [personError, setPersonError] = useState<'invalid' | 'full' | null>(null);
    const [friendFull, setFriendFull] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    // The person makes the group, so the rest are one fewer than the most a group takes
    const full = people.length >= MAX_GROUP_MEMBERS - 1;
    const choices = friends.filter((item) => !people.some((listed) => listed.friend === item.id));
    // A friend gone since they were chosen is chosen no more
    const chosen = choices.some((item) => item.id === friend) ? friend : '';

    // The people with the one in the field added, or null when it can't be, and the field then says why
    const withTyped = (): Person[] | null => {
        const parsed = v.safeParse(sharedNameSchema, person);
        if (!parsed.success) {
            setPersonError('invalid');
            return null;
        }
        if (full) {
            setPersonError('full');
            return null;
        }
        const added = [...people, { id: crypto.randomUUID(), name: parsed.output }];
        setPeople(added);
        setPerson('');
        return added;
    };

    const addChosen = () => {
        const added = choices.find((item) => item.id === chosen);
        if (!added) return;
        if (full) {
            setFriendFull(true);
            return;
        }
        setPeople([...people, { id: crypto.randomUUID(), name: added.name, friend: added.id }]);
        setFriend('');
    };

    // Enter adds the person instead of making the group
    const handlePersonKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        withTyped();
    };

    // The group the server answered, put right against the list: the friends go in only now, and a make sent again after
    // a lost answer answers the group made first, whose people may not be the list any more. Each call is safe to send
    // again.
    const putRight = async (group: SharedGroup, wanted: readonly Person[]) => {
        let current = group;
        for (const member of group.members) {
            const listed = member.id === group.me || wanted.some((item) => item.id === member.id);
            if (member.leftAt === null && !listed) current = await removeMember(group.id, member.id);
        }
        for (const item of wanted) {
            const member = current.members.find((candidate) => candidate.id === item.id);
            if (item.friend !== undefined) {
                if (!member) current = await addFriend(group.id, item.id, { friend: item.friend });
            } else if (member?.name !== item.name) current = await savePerson(group.id, item.id, item.name);
        }
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
        const failed = (reason: GroupFailure) => {
            setFailure(reason);
            setBusy(false);
        };
        const dummies = others.flatMap((item) => (item.friend === undefined ? [{ id: item.id, name: item.name }] : []));
        const group = await createGroup({ id: ids.group, name: parsed.output, me: ids.me, others: dummies }).catch(
            (error: unknown) => failed(failureOf(error))
        );
        if (!group) return;
        // Once the group is made, a limit of groups is a friend's
        await putRight(group, others).then(
            () => navigate({ to: '/groups/$groupId', params: { groupId: group.id } }),
            (error: unknown) => failed(failureOfFriend(error))
        );
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
                {friends.length > 0 && (
                    <Field
                        label={t('new.friend')}
                        error={friendFull ? t('new.full', { max: MAX_GROUP_MEMBERS }) : null}
                    >
                        {(control) => (
                            <div className="new-group__row">
                                <div className="new-group__input">
                                    <Select
                                        {...control}
                                        disabled={disabled}
                                        options={[
                                            { value: '', label: t('new.friendNone') },
                                            ...choices.map((item) => ({ value: item.id, label: item.name })),
                                        ]}
                                        value={chosen}
                                        onChange={(next) => {
                                            setFriend(next);
                                            setFriendFull(false);
                                        }}
                                    />
                                </div>
                                <Button disabled={disabled || chosen === ''} onClick={addChosen}>
                                    {t('new.addFriend')}
                                </Button>
                            </div>
                        )}
                    </Field>
                )}
                {people.length > 0 && (
                    <CardList label={t('new.people')}>
                        {people.map((added) => (
                            <Card as="li" className="new-group__person" key={added.id}>
                                <span className="new-group__name">{added.name}</span>
                                <Button
                                    ghost
                                    aria-label={t('new.removeItem', { name: added.name })}
                                    disabled={disabled}
                                    onClick={() => {
                                        setPeople((current) => current.filter((item) => item !== added));
                                        setPersonError(null);
                                        setFriendFull(false);
                                    }}
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
