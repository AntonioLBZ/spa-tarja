import { useMemo, useRef, useState, type SubmitEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { failureOf, failureOfFriend, useFailureWords, type GroupFailure } from '@/features/groups/data/group-failure';
import { useGroupActions } from '@/features/groups/data/use-group-actions';
import { useGroupWords } from '@/features/groups/words/use-group-words';
import { memberBalances } from '@core/groups/balance';

import { isOwner } from './is-owner';
import { PeopleSheet } from './people-sheet';
import { PersonRow } from './person-row';
import { PersonSearch, type PersonChoice } from './person-search';
import { useFriends, type Friend } from './use-friends';

import type { Ledger } from '@/features/groups/data/use-ledgers';
import type { SharedGroup } from '@core/groups/shared-group';

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

// The members of a group who haven't left, each with what can be done to them, and adding somebody
const GroupPeople = (props: GroupPeopleProps) => {
    const { ledger, disabled } = props;
    const { group, entries, hasData } = ledger;
    const balances = useMemo(
        () => new Map(memberBalances(entries, group.members).map((balance) => [balance.memberId, balance.cents])),
        [entries, group.members]
    );
    const people = group.members.filter((member) => member.leftAt === null);
    // Where the focus goes when the row that had it leaves, or stops opening
    const heading = useRef<HTMLHeadingElement>(null);

    return (
        <section className="group-people">
            <PeopleSheet labelRef={heading}>
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
            </PeopleSheet>
            <AddPeople group={group} disabled={disabled} />
        </section>
    );
};

// A friend pressed in the search, waiting for the owner to say how they come in
interface Placing {
    friend: Friend;
    done: (name: string | null) => void;
}

// Adding people by the search (ADR-0038), at once: a dummy by name, or one of the person's friends as a new member or,
// for the owner, in place of a dummy, who is merged into them. A member id is kept until somebody is added, so one sent
// again after an answer that never came is the same; another press makes a new one.
const AddPeople = (props: AddPersonProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const { savePerson, addFriend } = useGroupActions();
    const friends = useFriends();
    const opener = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [id, setId] = useState(() => crypto.randomUUID());
    // What the last press was, so a press of the same one sent again keeps the id
    const [last, setLast] = useState('');
    const [placing, setPlacing] = useState<Placing | null>(null);
    // As a new member, or in place of the dummy with this id
    const [place, setPlace] = useState('new');
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    const dummies = isOwner(group) ? group.members.filter((member) => !member.claimed && member.leftAt === null) : [];
    // A dummy gone since it was chosen is chosen no more
    const placed = dummies.some((dummy) => dummy.id === place) ? place : 'new';

    const send = async (key: string, run: (memberId: string) => Promise<unknown>, failed: typeof failureOf) => {
        const memberId = key === last ? id : crypto.randomUUID();
        setId(memberId);
        setLast(key);
        setFailure(null);
        setBusy(true);
        try {
            await run(memberId);
            setId(crypto.randomUUID());
            setLast('');
            return true;
        } catch (error) {
            setFailure(failed(error));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const addAs = (friend: Friend, replaces: string) =>
        send(
            `friend:${friend.id}:${replaces}`,
            (memberId) =>
                addFriend(
                    group.id,
                    memberId,
                    replaces === 'new' ? { friend: friend.id } : { friend: friend.id, replaces }
                ),
            failureOfFriend
        );

    const pick = async (choice: PersonChoice): Promise<string | null> => {
        if ('name' in choice) {
            const added = await send(
                `name:${choice.name}`,
                (memberId) => savePerson(group.id, memberId, choice.name),
                failureOf
            );
            return added ? choice.name : null;
        }
        const { friend } = choice;
        if (dummies.length === 0) return (await addAs(friend, 'new')) ? friend.name : null;
        setFailure(null);
        setPlace('new');
        return new Promise((done) => setPlacing({ friend, done }));
    };

    const endPlacing = (name: string | null) => {
        placing?.done(name);
        setPlacing(null);
    };

    const handlePlace = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!placing) return;
        if (await addAs(placing.friend, placed)) endPlacing(placing.friend.name);
    };

    const step = placing && (
        <form className="group-people__place" onSubmit={(event) => void handlePlace(event)}>
            <Field label={t('people.placeOf', { name: placing.friend.name })}>
                {(control) => (
                    <Select
                        {...control}
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
            </Field>
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
            <Actions>
                <Button disabled={disabled || busy} type="submit">
                    {t('people.addFriend')}
                </Button>
            </Actions>
        </form>
    );

    return (
        <>
            <Button ref={opener} block disabled={disabled} onClick={() => setOpen(true)}>
                {t('people.add')}
            </Button>
            <PersonSearch
                open={open}
                title={t('people.add')}
                friends={friends}
                disabled={disabled || busy}
                failure={failure && !placing ? failureWords(failure) : undefined}
                step={step ?? undefined}
                onBack={() => endPlacing(null)}
                onPick={pick}
                onClose={() => {
                    endPlacing(null);
                    setFailure(null);
                    setOpen(false);
                    opener.current?.focus();
                }}
            />
        </>
    );
};

export { GroupPeople, type GroupPeopleProps };
