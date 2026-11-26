import { useState, type SubmitEvent } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Button } from '@/components/button/button';
import { ButtonLink } from '@/components/button/button-link';
import { Checkbox } from '@/components/checkbox/checkbox';
import { Field } from '@/components/field/field';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { failureOf, useFailureWords, type GroupFailure } from '@/features/groups/data/group-failure';
import { useGroupActions } from '@/features/groups/data/use-group-actions';
import { GroupPeople } from '@/features/groups/people/group-people';
import { isOwner } from '@/features/groups/people/is-owner';
import { usePinnedGroups } from '@/features/groups/pins/pinned-groups';
import { GroupGate } from '@/features/groups/screen/group-gate';
import { useGroupWords } from '@/features/groups/words/use-group-words';
import { useOnline } from '@/lib/offline';
import { MAX_PINNED_GROUPS, SHARED_NAME_MAX_LENGTH, sharedNameSchema } from '@core/groups/shared-group';

import { CloseGroup } from './close-group';

import type { Ledger } from '@/features/groups/data/use-ledgers';
import type { MySwitches, SharedGroup } from '@core/groups/shared-group';

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

// The settings of a group or a friend: what its owner changes for everybody, then what is the person's own, the people,
// the export, and last the way to leave or delete it. A closed group keeps only the person's own switches and the export.
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

    return (
        <section className="group-settings">
            <ScreenTitle className="group-settings__title">{t('edit.title', { name: words.title })}</ScreenTitle>
            <LiveNotice>{!online && t('offline')}</LiveNotice>
            {open && group.kind === 'group' && isOwner(group) && (
                <section className="group-settings__part">
                    <h2>{t('edit.forGroup')}</h2>
                    <GroupName group={group} disabled={!online} />
                    <SimplifyDebts group={group} disabled={!online} />
                </section>
            )}
            <section className="group-settings__part">
                <h2>{t('edit.forYou')}</h2>
                <PersonalSwitches group={group} disabled={!online} />
            </section>
            {open && group.kind === 'group' && <GroupPeople ledger={ledger} disabled={!online} />}
            <section className="group-settings__part">
                <h2>{t('edit.export')}</h2>
                <p className="hint">{t('edit.exportHint')}</p>
                <ButtonLink block to="/groups/$groupId/export" params={{ groupId: group.id }}>
                    {t('edit.exportLink')}
                </ButtonLink>
            </section>
            {open && <CloseGroup ledger={ledger} disabled={!online} />}
        </section>
    );
};

// Pin to Expenses for an open group, Show in my expenses, and Archive for a closed group: they belong to the person, so
// a closed group takes the last two too
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
    const pinned = asked?.pinned ?? group.pinnedAt !== null;
    const othersPinned = usePinnedGroups().filter((other) => other.id !== group.id).length;
    const full = !pinned && othersPinned >= MAX_PINNED_GROUPS;

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
            {group.closed === null && (
                <Checkbox
                    label={t('pin')}
                    hint={full ? t('pinFull', { max: MAX_PINNED_GROUPS }) : t('pinHint')}
                    checked={pinned}
                    disabled={disabled || full}
                    onChange={(checked) => void send({ pinned: checked })}
                />
            )}
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

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
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
            <Field
                label={t('edit.name')}
                error={invalid ? t('nameInvalid') : null}
                actions={
                    <>
                        <Button disabled={disabled || busy} type="submit">
                            {t('edit.save')}
                        </Button>
                    </>
                }
            >
                {(control) => (
                    <input
                        {...control}
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
