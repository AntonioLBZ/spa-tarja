import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema, type GroupMember, type SharedGroup } from '@core/shared-group';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { useGroupActions } from './use-group-actions';
import { useGroupWords } from './use-group-words';

import './person-row.css';

interface PersonRowProps {
    group: SharedGroup;
    member: GroupMember;
    // What they are owed or owe, or null while the group's expenses haven't reached the device
    cents: number | null;
    // Nothing can change without a connection
    disabled: boolean;
    // The row is about to leave the list
    onRemoved: () => void;
}

// What the open panel shows: the actions, or one of them asking for more
type Step = 'actions' | 'renaming' | 'removing';

// A member on the sheet of the people: the name first, then who they are and their balance. It opens with what the
// person may do to them; a row with nothing to do doesn't open.
const PersonRow = (props: PersonRowProps) => {
    const { group, member, cents, disabled, onRemoved } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const { savePerson, removeMember } = useGroupActions();
    const [expanded, setExpanded] = useState(false);
    const [step, setStep] = useState<Step>('actions');
    const [draft, setDraft] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    const name = words.nameOf(member.id);
    const isMe = member.id === group.me;
    const owner = group.members.some((item) => item.id === group.me && item.role === 'owner');
    // The owner renames anybody and a user themselves; the owner removes anybody else
    const canRename = owner || isMe;
    const canRemove = owner && !isMe;
    const tags = [
        isMe && t('people.you'),
        member.role === 'owner' && t('people.owner'),
        !member.claimed && t('people.notJoined'),
    ].filter(Boolean);

    // A step replaces the button that was pressed, so the focus is handed on by hand: into the step, and back to the
    // button that opened it when it closes
    const renameButton = useRef<HTMLButtonElement>(null);
    const removeButton = useRef<HTMLButtonElement>(null);
    const nameInput = useRef<HTMLInputElement>(null);
    const cancelButton = useRef<HTMLButtonElement>(null);
    const lastStep = useRef<Step>('actions');
    useEffect(() => {
        if (step === 'renaming') nameInput.current?.focus();
        else if (step === 'removing') cancelButton.current?.focus();
        else if (lastStep.current === 'renaming') renameButton.current?.focus();
        else if (lastStep.current === 'removing') removeButton.current?.focus();
        lastStep.current = step;
    }, [step]);

    const goTo = (next: Step) => {
        setStep(next);
        setFailure(null);
        setInvalid(false);
        if (next === 'renaming') setDraft(member.name);
    };

    const handleOpenChange = (open: boolean) => {
        setExpanded(open);
        if (!open) goTo('actions');
    };

    // What follows an action that went through: back to the actions after a rename, and out of the list after a remove,
    // which hands the focus on before the row leaves
    const run = async (action: () => Promise<unknown>, done: () => void) => {
        setFailure(null);
        setBusy(true);
        try {
            await action();
            done();
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setBusy(false);
        }
    };

    const handleRename = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(sharedNameSchema, draft);
        if (!parsed.success) {
            setInvalid(true);
            return;
        }
        void run(
            () => savePerson(group.id, member.id, parsed.output),
            () => setStep('actions')
        );
    };

    const summary = (
        <span className="person-row__body">
            <span className="person-row__name">{name}</span>
            <span className="person-row__detail">
                {tags.map((tag) => (
                    <span key={String(tag)}>{tag}</span>
                ))}
                {cents !== null && <span>{words.sentence(member.id, cents)}</span>}
            </span>
        </span>
    );

    if (!canRename && !canRemove) return <li className="person-row">{summary}</li>;

    return (
        <Disclosure as="li" chevron summary={summary} open={expanded} onOpenChange={handleOpenChange}>
            {step === 'actions' && (
                <div className="person-row__actions">
                    {canRename && (
                        <Button
                            ghost
                            ref={renameButton}
                            aria-label={t('people.renameItem', { name })}
                            disabled={disabled}
                            onClick={() => goTo('renaming')}
                        >
                            {t('people.rename')}
                        </Button>
                    )}
                    {canRemove && (
                        <Button
                            ghost
                            ref={removeButton}
                            variant="danger"
                            aria-label={t('people.removeItem', { name })}
                            disabled={disabled}
                            onClick={() => goTo('removing')}
                        >
                            {t('people.remove')}
                        </Button>
                    )}
                </div>
            )}
            {step === 'renaming' && (
                <form className="person-row__form" onSubmit={handleRename}>
                    <Field label={t('people.newName')} error={invalid ? t('nameInvalid') : null}>
                        {(control) => (
                            <input
                                {...control}
                                ref={nameInput}
                                autoComplete="off"
                                disabled={disabled}
                                maxLength={SHARED_NAME_MAX_LENGTH}
                                type="text"
                                value={draft}
                                onChange={(event) => {
                                    setDraft(event.target.value);
                                    setInvalid(false);
                                }}
                            />
                        )}
                    </Field>
                    <div className="person-row__actions">
                        <Button ghost disabled={disabled || busy} type="submit">
                            {t('people.save')}
                        </Button>
                        <Button ghost onClick={() => goTo('actions')}>
                            {t('people.cancel')}
                        </Button>
                    </div>
                </form>
            )}
            {step === 'removing' && (
                <>
                    {/* A balance that isn't zero is said before asking; the server still decides */}
                    <p className="person-row__question">
                        {cents ? t('people.unsettled', { name }) : t('people.removeConfirm', { name })}
                    </p>
                    <div className="person-row__actions">
                        {!cents && (
                            <Button
                                ghost
                                variant="danger"
                                aria-label={t('people.removeItem', { name })}
                                disabled={disabled || busy}
                                onClick={() => void run(() => removeMember(group.id, member.id), onRemoved)}
                            >
                                {t('people.remove')}
                            </Button>
                        )}
                        <Button ghost ref={cancelButton} onClick={() => goTo('actions')}>
                            {t('people.cancel')}
                        </Button>
                    </div>
                </>
            )}
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
        </Disclosure>
    );
};

export { PersonRow, type PersonRowProps };
