import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState, type SubmitEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { failureOf, failureOfFriend, useFailureWords, type GroupFailure } from '@/features/groups/data/group-failure';
import { useGroupActions } from '@/features/groups/data/use-group-actions';
import { PeopleRow, PeopleSheet } from '@/features/groups/people/people-sheet';
import { PersonLine } from '@/features/groups/people/person-line';
import { PersonSearch, type PersonChoice } from '@/features/groups/people/person-search';
import { useFriends } from '@/features/groups/people/use-friends';
import { profileQuery } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { useOnline } from '@/lib/offline';
import {
    MAX_GROUP_MEMBERS,
    SHARED_NAME_MAX_LENGTH,
    personName,
    sharedNameSchema,
    type SharedGroup,
} from '@core/groups/shared-group';

import './new-group.css';

// Somebody to add: a dummy by name, or one of the person's friends, named by the id of that friend. `id` is the member
// they will be, made when they are listed and kept while the screen is open.
interface Person {
    id: string;
    name: string;
    friend?: string;
}

// The screen of a new group (ADR-0038): its name and its people, found by the search of people. The ids are made once
// and kept while the screen is open, so a group sent again after an answer that never came is the same group.
const NewGroup = () => {
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const navigate = useNavigate();
    const online = useOnline();
    const disabled = !online;
    const { createGroup, savePerson, addFriend, removeMember } = useGroupActions();
    const friends = useFriends();
    const [ids] = useState(() => ({ group: crypto.randomUUID(), me: crypto.randomUUID() }));
    const addButton = useRef<HTMLButtonElement>(null);
    const user = useUser();
    const { data: profile } = useQuery(profileQuery());
    // The name the person will have in the group, as the server gives it: the nickname, else the first name
    const me = personName({ nickname: profile?.nickname ?? null, name: user.name });

    const [name, setName] = useState('');
    const [people, setPeople] = useState<Person[]>([]);
    const [searching, setSearching] = useState(false);
    const [nameInvalid, setNameInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    // The person makes the group, so the rest are one fewer than the most a group takes
    const full = people.length >= MAX_GROUP_MEMBERS - 1;
    const choices = friends.filter((item) => !people.some((listed) => listed.friend === item.id));

    const pick = (choice: PersonChoice) => {
        if (full) return null;
        const added =
            'friend' in choice
                ? { id: crypto.randomUUID(), name: choice.friend.name, friend: choice.friend.id }
                : { id: crypto.randomUUID(), name: choice.name };
        setPeople((current) => [...current, added]);
        return added.name;
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

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(sharedNameSchema, name);
        if (!parsed.success) {
            setNameInvalid(true);
            return;
        }

        setFailure(null);
        setBusy(true);
        const failed = (reason: GroupFailure) => {
            setFailure(reason);
            setBusy(false);
        };
        const dummies = people.flatMap((item) => (item.friend === undefined ? [{ id: item.id, name: item.name }] : []));
        const group = await createGroup({ id: ids.group, name: parsed.output, me: ids.me, others: dummies }).catch(
            (error: unknown) => failed(failureOf(error))
        );
        if (!group) return;
        // Once the group is made, a limit of groups is a friend's
        await putRight(group, people).then(
            () => navigate({ to: '/groups/$groupId', params: { groupId: group.id } }),
            (error: unknown) => failed(failureOfFriend(error))
        );
    };

    return (
        <section className="new-group">
            <ScreenTitle>{t('new.title')}</ScreenTitle>
            <LiveNotice>{!online && t('offline')}</LiveNotice>
            <form className="new-group__form" onSubmit={(event) => void handleSubmit(event)}>
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
                <div className="new-group__people">
                    <Button ref={addButton} block disabled={disabled} onClick={() => setSearching(true)}>
                        {t('new.addPeople')}
                    </Button>
                    <p className="hint">{t('new.addPeopleHint')}</p>
                </div>
                <PeopleSheet>
                    <PeopleRow>
                        <PersonLine user name={me} details={[t('people.you'), t('people.owner')]} />
                    </PeopleRow>
                    {people.map((added) => (
                        <PeopleRow key={added.id}>
                            <PersonLine
                                user={added.friend !== undefined}
                                name={added.name}
                                details={added.friend === undefined ? [t('people.notJoined')] : []}
                            />
                            <Button
                                ghost
                                aria-label={t('new.removeItem', { name: added.name })}
                                disabled={disabled}
                                onClick={() => {
                                    setPeople((current) => current.filter((item) => item !== added));
                                    addButton.current?.focus();
                                }}
                            >
                                {t('new.remove')}
                            </Button>
                        </PeopleRow>
                    ))}
                </PeopleSheet>
                <Button block variant="primary" disabled={disabled || busy} type="submit">
                    {t('new.submit')}
                </Button>
                {failure && (
                    <Notice tone="danger" role="alert">
                        {failureWords(failure)}
                    </Notice>
                )}
            </form>
            <PersonSearch
                open={searching}
                title={t('new.addPeople')}
                friends={choices}
                disabled={disabled}
                full={full ? t('new.full', { max: MAX_GROUP_MEMBERS }) : undefined}
                onPick={pick}
                onClose={() => {
                    setSearching(false);
                    addButton.current?.focus();
                }}
            />
        </section>
    );
};

export { NewGroup };
