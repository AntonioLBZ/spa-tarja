import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { Sheet } from '@/components/sheet/sheet';
import { memberBalances } from '@core/balance';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema, type SharedGroup } from '@core/shared-group';

import { failureOf, failureOfFriend, useFailureWords, type GroupFailure } from './group-failure';
import { isOwner } from './is-owner';
import { PersonRow } from './person-row';
import { useGroupActions } from './use-group-actions';
import { useGroupWords } from './use-group-words';
import { useRealFriends } from './use-real-friends';

import type { Ledger } from './use-ledgers';

import './group-people.css';

interface GroupPeopleProps {
    ledger: Ledger;
    // Nothing can change without a connection
    disabled: boolean;
}

interface AddPersonProps {
    group: SharedGroup;
    disabled: boolean;
}

// The members of a group who haven't left, each with what can be done to them, and adding a dummy or a friend
const GroupPeople = (props: GroupPeopleProps) => {
    const { ledger, disabled } = props;
    const { group, entries, hasData } = ledger;
    const t = useTranslations('groups.people');
    const balances = useMemo(
        () => new Map(memberBalances(entries, group.members).map((balance) => [balance.memberId, balance.cents])),
        [entries, group.members]
    );
    const people = group.members.filter((member) => member.leftAt === null);
    // Where the focus goes when the row that had it leaves, or stops opening
    const heading = useRef<HTMLHeadingElement>(null);

    return (
        <section className="group-people">
            <Sheet label={t('title')} labelRef={heading}>
                <CardList flush>
                    {people.map((member) => (
                        <PersonRow
                            key={member.id}
                            group={group}
                            member={member}
                            cents={hasData ? (balances.get(member.id) ?? 0) : null}
                            disabled={disabled}
                            onGone={() => heading.current?.focus()}
                        />
                    ))}
                </CardList>
            </Sheet>
            <AddPerson group={group} disabled={disabled} />
            <AddFriendMember group={group} disabled={disabled} />
        </section>
    );
};

// A dummy by name. Its id is kept until it is added, so one sent again after an answer that never came is the same.
const AddPerson = (props: AddPersonProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const { savePerson } = useGroupActions();
    const [id, setId] = useState(() => crypto.randomUUID());
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
            await savePerson(group.id, id, parsed.output);
            setId(crypto.randomUUID());
            setName('');
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="group-people__add" onSubmit={(event) => void handleSubmit(event)}>
            <Field label={t('people.add')} hint={t('people.addHint')} error={invalid ? t('nameInvalid') : null}>
                {(control) => (
                    <div className="group-people__row">
                        <input
                            {...control}
                            className="group-people__input"
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
                        <Button disabled={disabled || busy} type="submit">
                            {t('people.addSubmit')}
                        </Button>
                    </div>
                )}
            </Field>
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
        </form>
    );
};

// One of the person's friends who use the app, at once: as a new member or, for the owner, in place of a dummy, who is
// merged into them. The member id is kept until the friend is added, so one sent again is the same; choosing another
// friend makes a new one.
const AddFriendMember = (props: AddPersonProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const { addFriend } = useGroupActions();
    const friends = useRealFriends();
    const placeName = useId();
    const field = useRef<HTMLButtonElement>(null);
    const [id, setId] = useState(() => crypto.randomUUID());
    // The friend chosen, or '' for none
    const [friend, setFriend] = useState('');
    // As a new member, or in place of the dummy with this id
    const [place, setPlace] = useState('new');
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    if (friends.length === 0) return null;

    const dummies = isOwner(group) ? group.members.filter((member) => !member.claimed && member.leftAt === null) : [];
    // A friend or a dummy gone since they were chosen is chosen no more
    const chosen = friends.some((item) => item.id === friend) ? friend : '';
    const placed = dummies.some((dummy) => dummy.id === place) ? place : 'new';

    const choose = (next: string) => {
        setFriend(next);
        setPlace('new');
        setId(crypto.randomUUID());
        setFailure(null);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (chosen === '') return;

        setFailure(null);
        setBusy(true);
        try {
            await addFriend(group.id, id, placed === 'new' ? { friend: chosen } : { friend: chosen, replaces: placed });
            choose('');
            field.current?.focus();
        } catch (error) {
            setFailure(failureOfFriend(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="group-people__friend" onSubmit={(event) => void handleSubmit(event)}>
            <Field label={t('people.friend')}>
                {(control) => (
                    <Select
                        {...control}
                        ref={field}
                        disabled={disabled}
                        label={t('people.friend')}
                        options={[
                            { value: '', label: t('people.friendNone') },
                            ...friends.map((item) => ({ value: item.id, label: item.name })),
                        ]}
                        value={chosen}
                        onChange={choose}
                    />
                )}
            </Field>
            {chosen !== '' && dummies.length > 0 && (
                <ChoiceGroup
                    legend={t('people.place')}
                    name={placeName}
                    options={[
                        { value: 'new', label: t('people.asNew') },
                        ...dummies.map((dummy) => ({
                            value: dummy.id,
                            label: t('people.inPlaceOf', { name: words.nameOf(dummy.id) }),
                        })),
                    ]}
                    value={placed}
                    onChange={setPlace}
                />
            )}
            <Button block disabled={disabled || busy || chosen === ''} type="submit">
                {t('people.addFriend')}
            </Button>
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
        </form>
    );
};

export { GroupPeople, type GroupPeopleProps };
