import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Checkbox } from '@/components/checkbox/checkbox';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { useLocale } from '@/lib/i18n';
import { splitEvenly } from '@core/installments';
import { formatAmount, formatAmountInput, parseAmount } from '@core/money';
import { SPLIT_MODES } from '@core/shared-entry';
import {
    HUNDRED_PERCENT,
    equalPercents,
    percentLeft,
    splitByPercent,
    splitEqually,
    splitExactly,
    unassignedCents,
} from '@core/split';

import { groupTitle, memberNames } from './member-names';
import { newEntry } from './new-entry';
import { readSharedWith } from './shared-with';
import { useGroupWords } from './use-group-words';
import { useGroups } from './use-ledgers';

import type { PaymentState } from '@/features/expenses/payment-fields';
import type { Share, SharedEntry, SplitMode } from '@core/shared-entry';
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
    // What was typed in the percentages or the amounts since the mode was chosen
    typed: TypedShares | null;
}

// The shares as typed, by member, valid only for the members who were in, and for amounts the total, when typed
interface TypedShares {
    key: string;
    values: Readonly<Record<string, string>>;
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

// Why the shares can't be saved yet. `left` is what is left to assign, or over it when negative: hundredths of a percent
// by percent, cents by amount.
type SplitProblem = { kind: 'nobody' } | { kind: 'invalid'; ids: readonly string[] } | { kind: 'left'; left: number };

const START: SharedDraft = { groupId: null, paidBy: null, mode: 'equal', out: [], typed: null };

// A percentage as typed, in hundredths of a percent, the way an amount is read in cents; none past 100 %
const parsePercent = (text: string, locale: string): number | null => {
    const basisPoints = parseAmount(text.replace(/%/g, ''), locale);
    return basisPoints !== null && basisPoints <= HUNDRED_PERCENT ? basisPoints : null;
};

// The shares worked out in cents for the mode, or why they can't be yet
const splitOf = (
    mode: SplitMode,
    amount: number | null,
    values: ReadonlyArray<{ memberId: string; value: number | null }>
): { shares: Share[] | null; problem: SplitProblem | null } => {
    if (values.length === 0) return { shares: null, problem: { kind: 'nobody' } };
    const ids = values.map((item) => item.memberId);
    if (mode === 'equal') return { shares: amount === null ? null : splitEqually(amount, ids), problem: null };
    // The amounts wait for the total they are typed against
    if (mode === 'exact' && amount === null) return { shares: null, problem: null };

    const invalid = values.filter((item) => item.value === null).map((item) => item.memberId);
    if (invalid.length > 0) return { shares: null, problem: { kind: 'invalid', ids: invalid } };
    const typed = values.map((item) => ({ memberId: item.memberId, value: item.value ?? 0 }));

    if (mode === 'percent') {
        const percents = typed.map((item) => ({ memberId: item.memberId, basisPoints: item.value }));
        const left = percentLeft(percents);
        if (left !== 0) return { shares: null, problem: { kind: 'left', left } };
        return { shares: amount === null ? null : splitByPercent(amount, percents), problem: null };
    }

    const parts = typed.map((item) => ({ memberId: item.memberId, cents: item.value }));
    const left = unassignedCents(amount ?? 0, parts);
    if (left !== 0) return { shares: null, problem: { kind: 'left', left } };
    return { shares: splitExactly(amount ?? 0, parts), problem: null };
};

// The open groups, then the open friends, as the Groups tab lists them
const openChoices = (groups: readonly SharedGroup[]): SharedGroup[] => {
    const open = groups.filter((group) => group.closed === null);
    return [...open.filter((group) => group.kind !== 'direct'), ...open.filter((group) => group.kind === 'direct')];
};

// The tail of a shared expense: the group or friend, who paid and how it is split, in cents. Given a group, it is
// shared there; otherwise in one of the person's open groups and friends.
const useSharedTail = (fixed: SharedGroup | undefined, totalCents: number | null, payment: PaymentState) => {
    const { groups } = useGroups();
    const { locale } = useLocale();
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

    // The percentages start from 100 % split evenly, the amounts from the equal split, until one is typed
    const key = draft.mode === 'exact' ? `${amount}:${inIds.join()}` : inIds.join();
    const startTexts = (): string[] => {
        if (draft.mode === 'percent') {
            return equalPercents(inIds).map((percent) => formatAmountInput(percent.basisPoints, locale));
        }
        if (amount === null) return inIds.map(() => '');
        return splitEvenly(amount, inIds.length).map((cents) => formatAmountInput(cents, locale));
    };
    const texts: Readonly<Record<string, string>> =
        draft.mode === 'equal'
            ? {}
            : draft.typed?.key === key
              ? draft.typed.values
              : Object.fromEntries(startTexts().map((text, index) => [inIds[index]!, text]));
    const parse = draft.mode === 'percent' ? parsePercent : parseAmount;
    const { shares, problem } = splitOf(
        draft.mode,
        amount,
        inIds.map((memberId) => ({ memberId, value: parse(texts[memberId] ?? '', locale) }))
    );
    const valid = group !== undefined && shares !== null && shares.length > 0 && problem === null;

    // What each member who can take part shows: nothing when out; else, split equally, their share once there is an
    // amount, and otherwise what is typed for them
    const rows = present.map((member) => {
        const isIn = inIds.includes(member.id);
        const share = shares?.find((item) => item.memberId === member.id)?.cents ?? 0;
        return {
            id: member.id,
            isIn,
            cents: isIn && draft.mode === 'equal' && shares ? share : null,
            text: isIn && draft.mode !== 'equal' ? (texts[member.id] ?? '') : null,
            invalid: problem?.kind === 'invalid' && problem.ids.includes(member.id),
        };
    });

    return {
        choices,
        group,
        present,
        payer,
        rows,
        mode: draft.mode,
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
        pickMode: (mode: SplitMode) => setDraft({ ...draft, mode, typed: null }),
        type: (memberId: string, text: string) => {
            setDraft({ ...draft, typed: { key, values: { ...texts, [memberId]: text } } });
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
    const id = useId();
    const nameOf = (memberId: string) => (memberId === group.me ? t('you') : words.nameOf(memberId));
    const { mode, problem } = tail;
    const byPercent = mode === 'percent';
    const money = (cents: number) => formatAmount(Math.abs(cents), group.currency, locale);
    const percent = (basisPoints: number) =>
        new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(
            Math.abs(basisPoints) / HUNDRED_PERCENT
        );

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

            <ChoiceGroup
                legend={t('split')}
                name={`${id}-split`}
                options={SPLIT_MODES.map((value) => ({ value, label: t(`modes.${value}`) }))}
                value={mode}
                onChange={tail.pickMode}
            />

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
                            {row.cents !== null && <span>{money(row.cents)}</span>}
                            {row.text !== null && (
                                <input
                                    className="shared-people__input"
                                    aria-describedby={row.invalid ? `${id}-invalid` : undefined}
                                    aria-invalid={row.invalid}
                                    aria-label={t(byPercent ? 'percentOf' : 'amountOf', { name: nameOf(row.id) })}
                                    autoComplete="off"
                                    inputMode="decimal"
                                    type="text"
                                    value={row.text}
                                    onChange={(event) => tail.type(row.id, event.target.value)}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            </fieldset>

            {problem?.kind === 'nobody' && (
                <Notice tone="danger" role="alert">
                    {t('nobody')}
                </Notice>
            )}
            {problem?.kind === 'invalid' && (
                <Notice tone="danger" role="alert" id={`${id}-invalid`}>
                    {t(byPercent ? 'percentInvalid' : 'amountInvalid')}
                </Notice>
            )}
            {problem?.kind === 'left' && problem.left > 0 && (
                <p className="field__hint" role="status">
                    {byPercent
                        ? t('percentLeft', { percent: percent(problem.left) })
                        : t('unassigned', { amount: money(problem.left) })}
                </p>
            )}
            {problem?.kind === 'left' && problem.left < 0 && (
                <Notice tone="danger" role="alert">
                    {byPercent
                        ? t('percentOver', { percent: percent(problem.left) })
                        : t('over', { amount: money(problem.left) })}
                </Notice>
            )}
        </>
    );
};

export { SharedTail, useSharedTail, type SharedTailProps, type SharedTailState };
