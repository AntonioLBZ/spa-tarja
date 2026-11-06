import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema, type GroupMember, type SharedGroup } from '@core/shared-group';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { isOwner } from './is-owner';
import { isUser } from './is-user';
import { useGroupActions } from './use-group-actions';
import { useGroupWords } from './use-group-words';
import { useStepFocus } from './use-step-focus';

import './person-row.css';

interface PersonRowProps {
    group: SharedGroup;
    member: GroupMember;
    // What they are owed or owe, or null while the group's expenses haven't reached the device
    cents: number | null;
    // Nothing can change without a connection
    disabled: boolean;
    // The row is about to leave the list, or to have nothing left to open
    onGone: () => void;
}

// What the open panel shows: the actions, or one of them asking for more
type Step = 'actions' | 'renaming' | 'merging' | 'handingOver' | 'removing';

// A member on the sheet of the people: the name first, then who they are and their balance. It opens with what the
// person may do to them; a row with nothing to do doesn't open.
const PersonRow = (props: PersonRowProps) => {
    const { group, member, cents, disabled, onGone } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const words = useGroupWords(group);
    const { savePerson, removeMember, merge, handOver } = useGroupActions();
    const [expanded, setExpanded] = useState(false);
    const [step, setStep] = useState<Step>('actions');
    const [draft, setDraft] = useState('');
    // Whom a dummy is merged into, or '' while nobody is chosen: it can't be undone, so nobody is chosen for the person
    const [into, setInto] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);
    const focus = useStepFocus(step, 'actions');
    const questionId = useId();

    const name = words.nameOf(member.id);
    const isMe = member.id === group.me;
    const owner = isOwner(group);
    // The owner renames anybody and a user themselves; the owner merges a dummy into a user, makes another user owner
    // and removes anybody else
    const canRename = owner || isMe;
    const canMerge = owner && !member.claimed;
    const canHandOver = owner && !isMe && isUser(member);
    const canRemove = owner && !isMe;
    // Whom a dummy can be merged into, in the group's order
    const targets = group.members
        .filter((target) => isUser(target) && target.leftAt === null)
        .map((target) => ({ value: target.id, label: words.nameInList(target.id) }));
    // Nobody again when the one chosen left or was merged meanwhile
    const chosen = targets.some((target) => target.value === into) ? into : '';
    const tags = [
        isMe && t('people.you'),
        member.role === 'owner' && t('people.owner'),
        !member.claimed && t('people.notJoined'),
    ].filter(Boolean);

    const goTo = (next: Step) => {
        setStep(next);
        setFailure(null);
        setInvalid(false);
        if (next === 'renaming') setDraft(member.name);
        if (next === 'merging') setInto('');
    };

    const handleOpenChange = (open: boolean) => {
        setExpanded(open);
        if (!open) goTo('actions');
    };

    // What follows an action that went through: back to the actions after a rename, and onGone after the rest, which
    // hands the focus on before the row leaves or stops opening
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

    // Cancel, which is where a step that only asks starts; a step with a question has Cancel read it
    const cancel = (asks: boolean, question = false) => (
        <Button
            ghost
            ref={asks ? focus.start : undefined}
            aria-describedby={question ? questionId : undefined}
            onClick={() => goTo('actions')}
        >
            {t('people.cancel')}
        </Button>
    );

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
                            ref={focus.opener('renaming')}
                            aria-label={t('people.renameItem', { name })}
                            disabled={disabled}
                            onClick={() => goTo('renaming')}
                        >
                            {t('people.rename')}
                        </Button>
                    )}
                    {canMerge && (
                        <Button
                            ghost
                            ref={focus.opener('merging')}
                            aria-label={t('people.mergeItem', { name })}
                            disabled={disabled}
                            onClick={() => goTo('merging')}
                        >
                            {t('people.merge')}
                        </Button>
                    )}
                    {canHandOver && (
                        <Button
                            ghost
                            ref={focus.opener('handingOver')}
                            aria-label={t('people.makeOwnerItem', { name })}
                            disabled={disabled}
                            onClick={() => goTo('handingOver')}
                        >
                            {t('people.makeOwner')}
                        </Button>
                    )}
                    {canRemove && (
                        <Button
                            ghost
                            ref={focus.opener('removing')}
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
                                ref={focus.start}
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
                        {cancel(false)}
                    </div>
                </form>
            )}
            {step === 'merging' && (
                <>
                    <p id={questionId} className="person-row__question">
                        {t('people.mergeQuestion', { name })}
                    </p>
                    <Field label={t('people.mergeInto')}>
                        {(control) => (
                            <Select
                                {...control}
                                ref={focus.start}
                                label={t('people.mergeInto')}
                                options={[{ value: '', label: t('people.mergeNone') }, ...targets]}
                                value={chosen}
                                onChange={setInto}
                            />
                        )}
                    </Field>
                    <div className="person-row__actions">
                        <Button
                            ghost
                            aria-label={t('people.mergeConfirmItem', { name })}
                            disabled={disabled || busy || chosen === ''}
                            onClick={() => void run(() => merge(group.id, member.id, chosen), onGone)}
                        >
                            {t('people.mergeConfirm')}
                        </Button>
                        {cancel(false, true)}
                    </div>
                </>
            )}
            {step === 'handingOver' && (
                <>
                    <p id={questionId} className="person-row__question">
                        {t('people.makeOwnerQuestion', { name })}
                    </p>
                    <div className="person-row__actions">
                        <Button
                            ghost
                            aria-label={t('people.makeOwnerItem', { name })}
                            disabled={disabled || busy}
                            onClick={() => void run(() => handOver(group.id, member.id), onGone)}
                        >
                            {t('people.makeOwner')}
                        </Button>
                        {cancel(true, true)}
                    </div>
                </>
            )}
            {step === 'removing' && (
                <>
                    {/* A balance that isn't zero is said before asking; the server still decides */}
                    <p id={questionId} className="person-row__question">
                        {cents ? t('people.unsettled', { name }) : t('people.removeConfirm', { name })}
                    </p>
                    <div className="person-row__actions">
                        {!cents && (
                            <Button
                                ghost
                                variant="danger"
                                aria-label={t('people.removeItem', { name })}
                                disabled={disabled || busy}
                                onClick={() => void run(() => removeMember(group.id, member.id), onGone)}
                            >
                                {t('people.remove')}
                            </Button>
                        )}
                        {cancel(true, true)}
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
