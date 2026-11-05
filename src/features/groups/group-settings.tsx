import { useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { Checkbox } from '@/components/checkbox/checkbox';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { useOnline } from '@/lib/offline';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema } from '@core/shared-group';

import { CloseGroup } from './close-group';
import { FriendInvite } from './friend-invite';
import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { GroupGate } from './group-gate';
import { GroupPeople } from './group-people';
import { isOwner } from './is-owner';
import { useGroupActions } from './use-group-actions';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';
import type { MySwitches, SharedGroup } from '@core/shared-group';

import './group-settings.css';

interface GroupSettingsProps {
    groupId: string;
}

interface SettingsViewProps {
    ledger: Ledger;
}

interface SectionProps {
    group: SharedGroup;
    // Everything that shapes a group needs a connection
    disabled: boolean;
}

// The settings of a group or a friend, ending with the way to leave or delete it. A closed group keeps only the
// person's own switches.
const GroupSettings = (props: GroupSettingsProps) => {
    const { groupId } = props;

    return <GroupGate groupId={groupId}>{(ledger) => <SettingsView ledger={ledger} />}</GroupGate>;
};

const SettingsView = (props: SettingsViewProps) => {
    const { ledger } = props;
    const { group } = ledger;
    const t = useTranslations('groups');
    const online = useOnline();
    const words = useGroupWords(group);
    const open = group.closed === null;
    // A friend whose other side nobody has taken yet, which an invitation is for
    const invitable = open && group.kind === 'direct' && group.members.some((member) => !member.claimed);

    return (
        <section className="group-settings">
            <h1 className="group-settings__title">{t('edit.title', { name: words.title })}</h1>
            {!online && <Notice role="status">{t('offline')}</Notice>}
            <PersonalSwitches group={group} disabled={!online} />
            {open && group.kind === 'group' && isOwner(group) && (
                <>
                    <GroupName group={group} disabled={!online} />
                    <SimplifyDebts group={group} disabled={!online} />
                </>
            )}
            {open && group.kind === 'group' && <GroupPeople ledger={ledger} disabled={!online} />}
            {invitable && <FriendInvite group={group} disabled={!online} />}
            {open && <CloseGroup ledger={ledger} disabled={!online} />}
        </section>
    );
};

// Show in my expenses, and Archive for a closed group: they belong to the person, so a closed group takes them too
const PersonalSwitches = (props: SectionProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups.edit');
    const failureWords = useFailureWords();
    const { setSwitches } = useGroupActions();
    // What was asked for, shown until the server answers
    const [asked, setAsked] = useState<MySwitches | null>(null);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const shown = asked?.showInExpenses ?? group.showInExpenses;
    const archived = asked?.archived ?? group.archived;

    const send = async (switches: MySwitches) => {
        if (asked) return;
        setAsked(switches);
        setFailure(null);
        try {
            await setSwitches(group.id, switches);
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setAsked(null);
        }
    };

    return (
        <div className="group-settings__section">
            <Checkbox
                label={t('show')}
                hint={t('showHint')}
                checked={shown}
                disabled={disabled}
                onChange={(checked) => void send({ showInExpenses: checked })}
            />
            {group.closed !== null && (
                <Button
                    ghost
                    className="group-settings__archive"
                    disabled={disabled}
                    onClick={() => void send({ archived: !archived })}
                >
                    {archived ? t('unarchive') : t('archive')}
                </Button>
            )}
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
        </div>
    );
};

// The name of a group, which only its owner changes
const GroupName = (props: SectionProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups');
    const failureWords = useFailureWords();
    const { change } = useGroupActions();
    // What the person typed, over the stored name until it is saved
    const [draft, setDraft] = useState<string | null>(null);
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);
    const value = draft ?? group.name ?? '';

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = v.safeParse(sharedNameSchema, value);
        if (!parsed.success) {
            setInvalid(true);
            return;
        }

        const sent = draft;
        setFailure(null);
        setBusy(true);
        try {
            await change(group.id, { name: parsed.output });
            // What was typed while it was on its way stays
            setDraft((current) => (current === sent ? null : current));
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="group-settings__section" onSubmit={(event) => void handleSubmit(event)}>
            <Field label={t('edit.name')} error={invalid ? t('nameInvalid') : null}>
                {(control) => (
                    <div className="group-settings__row">
                        <input
                            {...control}
                            className="group-settings__input"
                            autoComplete="off"
                            disabled={disabled}
                            maxLength={SHARED_NAME_MAX_LENGTH}
                            type="text"
                            value={value}
                            onChange={(event) => {
                                setDraft(event.target.value);
                                setInvalid(false);
                            }}
                        />
                        <Button disabled={disabled || busy} type="submit">
                            {t('edit.save')}
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

// Whether the group shows the fewest payments instead of who owes whom, which only its owner switches
const SimplifyDebts = (props: SectionProps) => {
    const { group, disabled } = props;
    const t = useTranslations('groups.edit');
    const failureWords = useFailureWords();
    const { change } = useGroupActions();
    // What was asked for, shown until the server answers
    const [asked, setAsked] = useState<boolean | null>(null);
    const [failure, setFailure] = useState<GroupFailure | null>(null);

    const send = async (simplifyDebts: boolean) => {
        if (asked !== null) return;
        setAsked(simplifyDebts);
        setFailure(null);
        try {
            await change(group.id, { simplifyDebts });
        } catch (error) {
            setFailure(failureOf(error));
        } finally {
            setAsked(null);
        }
    };

    return (
        <div className="group-settings__section">
            <Checkbox
                label={t('simplify')}
                hint={t('simplifyHint')}
                checked={asked ?? group.simplifyDebts}
                disabled={disabled}
                onChange={(checked) => void send(checked)}
            />
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
        </div>
    );
};

export { GroupSettings, type GroupSettingsProps };
