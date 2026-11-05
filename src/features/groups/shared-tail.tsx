import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Checkbox } from '@/components/checkbox/checkbox';
import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { useLocale } from '@/lib/i18n';
import { formatAmount } from '@core/money';
import { splitEqually } from '@core/split';

import { groupTitle, memberNames } from './member-names';
import { newEntry } from './new-entry';
import { readSharedWith } from './shared-with';
import { useGroupWords } from './use-group-words';
import { useGroups } from './use-ledgers';

import type { PaymentState } from '@/features/expenses/payment-fields';
import type { SharedEntry, SplitMode } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

import './shared-tail.css';

// The shared tail as the form holds it while it is open. The group, the payer and who is out are ids, which may stop
// naming somebody who can take part: then they read as where the form starts.
interface SharedDraft {
    // Picked in With; null is the one used last
    groupId: string | null;
    // Null is the person
    paidBy: string | null;
    mode: SplitMode;
    // The members left out
    out: readonly string[];
}

// What the head of the form says of the expense
interface SharedHead {
    text: string;
    categoryId: string;
    amountCents: number;
    date: string;
}

interface SharedTailProps {
    tail: SharedTailState;
    payment: PaymentState;
    // On the screen of a group, the one it is shared in, with nothing to choose
    fixed: boolean;
}

interface SharedPeopleProps {
    group: SharedGroup;
    tail: SharedTailState;
}

type SharedTailState = ReturnType<typeof useSharedTail>;

const START: SharedDraft = { groupId: null, paidBy: null, mode: 'equal', out: [] };

// The open groups, then the open friends, as the Groups tab lists them
const openChoices = (groups: readonly SharedGroup[]): SharedGroup[] => {
    const open = groups.filter((group) => group.closed === null);
    return [...open.filter((group) => group.kind !== 'direct'), ...open.filter((group) => group.kind === 'direct')];
};

// The tail of a shared expense: the group or friend, who paid and how it is split, in cents. Given a group, it is
// shared there; otherwise in one of the person's open groups and friends.
const useSharedTail = (fixed: SharedGroup | undefined, totalCents: number | null, payment: PaymentState) => {
    const { groups } = useGroups();
    const [draft, setDraft] = useState<SharedDraft>(START);
    const [remembered] = useState(readSharedWith);
    const choices = useMemo(() => (fixed ? [fixed] : openChoices(groups)), [fixed, groups]);

    const group =
        choices.find((item) => item.id === draft.groupId) ??
        choices.find((item) => item.id === remembered) ??
        choices[0];
    // Those who can take part: a member who left, or was merged, can't
    const present = group?.members.filter((member) => member.leftAt === null) ?? [];
    const me = group?.me ?? null;
    const payer = present.find((member) => member.id === draft.paidBy)?.id ?? me;
    const payerIsMe = payer !== null && payer === me;
    const inIds = present.filter((member) => !draft.out.includes(member.id)).map((member) => member.id);
    const amount = totalCents !== null && totalCents >= 1 ? totalCents : null;
    const shares = amount === null ? null : splitEqually(amount, inIds);
    const problem = group && inIds.length === 0 ? 'nobody' : null;
    const valid = group !== undefined && shares !== null && shares.length > 0 && problem === null;

    // What each member who can take part shows: nothing when out, else their share once there is an amount
    const rows = present.map((member) => {
        const isIn = inIds.includes(member.id);
        const cents = isIn && shares ? (shares.find((item) => item.memberId === member.id)?.cents ?? 0) : null;
        return { id: member.id, isIn, cents };
    });

    return {
        choices,
        group,
        present,
        payer,
        rows,
        problem,
        valid,
        // The day the payer's card charges it; only the payer says how they paid
        chargeDate: payerIsMe ? payment.chargeDate : null,
        pickGroup: (groupId: string) => setDraft({ ...START, mode: draft.mode, groupId }),
        // Somebody else pays now: only the payer says how they paid
        pickPayer: (memberId: string) => {
            setDraft({ ...draft, paidBy: memberId });
            if (memberId !== me) payment.reset();
        },
        take: (memberId: string, isIn: boolean) => {
            const out = draft.out.filter((id) => id !== memberId);
            setDraft({ ...draft, out: isIn ? out : [...out, memberId] });
        },
        // The entry, with the group to write it in, while it can be saved
        entryOf: (head: SharedHead): { groupId: string; entry: SharedEntry } | null => {
            if (!group || !valid || payer === null || shares === null) return null;
            const entry = newEntry(group, {
                kind: 'expense',
                ...head,
                paidBy: payer,
                split: draft.mode,
                shares,
                payment: payerIsMe ? payment.payment : 'direct',
                chargeDate: payerIsMe ? payment.chargeDate : null,
            });
            return { groupId: group.id, entry };
        },
        // Back to where it starts, in the same group
        reset: () => setDraft({ ...START, groupId: group?.id ?? null }),
    };
};

const SharedTail = (props: SharedTailProps) => {
    const { tail, fixed } = props;
    const t = useTranslations('groups');
    const { group } = tail;

    const options = useMemo(() => {
        const words = {
            deleted: t('names.deleted'),
            numbered: (name: string, number: number) => t('names.numbered', { name, number }),
        };
        return tail.choices.map((choice) => ({
            value: choice.id,
            label: groupTitle(choice, memberNames(choice.members, words)),
            icon: <Icon name={choice.kind === 'direct' ? 'person' : 'groups'} />,
        }));
    }, [tail.choices, t]);

    if (!group) {
        return <Notice tone="quiet">{t('share.none')}</Notice>;
    }

    return (
        <>
            {!fixed && (
                <Field label={t('share.with')}>
                    {(control) => (
                        <Select
                            {...control}
                            label={t('share.with')}
                            options={options}
                            value={group.id}
                            onChange={tail.pickGroup}
                        />
                    )}
                </Field>
            )}
            <SharedPeople group={group} tail={tail} />
        </>
    );
};

// Who paid and who is in, with the share of each
const SharedPeople = (props: SharedPeopleProps) => {
    const { group, tail } = props;
    const t = useTranslations('groups.share');
    const { locale } = useLocale();
    const words = useGroupWords(group);
    const nameOf = (memberId: string) => (memberId === group.me ? t('you') : words.nameOf(memberId));

    return (
        <>
            <Field label={t('paidBy')}>
                {(control) => (
                    <Select
                        {...control}
                        label={t('paidBy')}
                        options={tail.present.map((member) => ({ value: member.id, label: nameOf(member.id) }))}
                        value={tail.payer ?? group.me}
                        onChange={tail.pickPayer}
                    />
                )}
            </Field>

            <fieldset className="shared-people">
                <legend className="shared-people__legend">{t('people')}</legend>
                <ul className="shared-people__list">
                    {tail.rows.map((row) => (
                        <li key={row.id} className="shared-people__row">
                            <Checkbox
                                label={nameOf(row.id)}
                                checked={row.isIn}
                                onChange={(checked) => tail.take(row.id, checked)}
                            />
                            {row.cents !== null && (
                                <span className="shared-people__share">
                                    {formatAmount(row.cents, group.currency, locale)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </fieldset>

            {tail.problem === 'nobody' && (
                <Notice tone="danger" role="alert">
                    {t('nobody')}
                </Notice>
            )}
        </>
    );
};

export { SharedTail, useSharedTail, type SharedTailProps, type SharedTailState };
