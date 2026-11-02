import { useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { memberBalances } from '@core/balance';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema, type SharedGroup } from '@core/shared-group';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { PersonRow } from './person-row';
import { useGroupActions } from './use-group-actions';

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

// The members of a group who haven't left, each with what can be done to them, and adding a person
const GroupPeople = (props: GroupPeopleProps) => {
    const { ledger, disabled } = props;
    const { group, entries, hasData } = ledger;
    const t = useTranslations('groups.people');
    const balances = useMemo(
        () => new Map(memberBalances(entries, group.members).map((balance) => [balance.memberId, balance.cents])),
        [entries, group.members]
    );
    const people = group.members.filter((member) => member.leftAt === null);

    return (
        <section className="group-people">
            <Sheet label={t('title')}>
                <CardList flush>
                    {people.map((member) => (
                        <PersonRow
                            key={member.id}
                            group={group}
                            member={member}
                            cents={hasData ? (balances.get(member.id) ?? 0) : null}
                            disabled={disabled}
                        />
                    ))}
                </CardList>
            </Sheet>
            <AddPerson group={group} disabled={disabled} />
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

export { GroupPeople, type GroupPeopleProps };
