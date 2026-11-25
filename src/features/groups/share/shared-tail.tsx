import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Checkbox } from '@/components/checkbox/checkbox';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field, FieldBox } from '@/components/field/field';
import { SpokenHint } from '@/components/field/spoken-hint';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { PaymentFields, type PaymentState } from '@/features/expenses/form/payment-fields';
import { newEntry } from '@/features/groups/data/new-entry';
import { useGroups } from '@/features/groups/data/use-ledgers';
import { useGroupWords } from '@/features/groups/words/use-group-words';
import { useAmountPlaceholder, useMoney } from '@/lib/amounts';
import { useUser } from '@/lib/auth';
import { useLocale } from '@/lib/i18n';
import { readSharedWith } from '@/lib/offline';
import { randomSeed } from '@/lib/random';
import { formatAmountInput, parseAmount } from '@core/basics/money';
import { SPLIT_MODES } from '@core/groups/shared-entry';
import { canonicalMember } from '@core/groups/shared-member';
import {
    HUNDRED_PERCENT,
    equalPercents,
    percentLeft,
    percentsOf,
    splitByPercent,
    splitEqually,
    splitExactly,
    unassignedCents,
} from '@core/groups/split';

import { groupsFirst, useGroupOptions } from './use-group-options';

import type { Share, SharedEntry, SplitMode } from '@core/groups/shared-entry';
import type { SharedExpenseEntry } from '@core/groups/shared-expense';
import type { SharedGroup } from '@core/groups/shared-group';

import './shared-tail.css';

// The shared tail as the form holds it while it is open. The group and who is out are ids, which may stop naming
// somebody who can take part: then they read as where the form starts. A payer who stops being there is not replaced.
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
    // The shares of the entry being edited, kept while nothing of the split is touched, as splitting its percentages
    // again may move a cent. A copy is a new expense and has none.
    saved: SavedShares | null;
}

// The shares of an entry, for the total they add up to
interface SavedShares {
    amountCents: number;
    shares: Share[];
}

// An expense of the group that the form edits, or copies into a new one
interface EntrySource {
    entry: SharedExpenseEntry;
    copy: boolean;
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
    // On the screen of a group, the one it is shared in, with nothing to choose
    fixed: boolean;
    // Add was pressed: what is left to assign and a payer who is gone are said as errors
    tried?: boolean;
}

interface LineProps {
    children: string;
}

interface SharedSummaryProps {
    tail: SharedTailState;
}

interface SharedPeopleProps {
    group: SharedGroup;
    tail: SharedTailState;
    tried: boolean;
}

interface SharedPaymentProps {
    tail: SharedTailState;
    payment: PaymentState;
}

type SharedTailState = ReturnType<typeof useSharedTail>;

// Why the shares can't be saved yet. `left` is what is left to assign, or over it when negative: hundredths of a percent
// by percent, cents by amount.
type SplitProblem = { kind: 'nobody' } | { kind: 'invalid'; ids: readonly string[] } | { kind: 'left'; left: number };

const START: SharedDraft = {
    groupId: null,
    paidBy: null,
    mode: 'equal',
    out: [],
    typed: null,
    saved: null,
};

// A percentage as typed, in hundredths of a percent, the way an amount is read in cents; none past 100 %
const parsePercent = (text: string, locale: string): number | null => {
    const basisPoints = parseAmount(text.replace(/%/g, ''), locale);
    return basisPoints !== null && basisPoints <= HUNDRED_PERCENT ? basisPoints : null;
};

// The shares worked out in cents for the mode, or why they can't be yet
const splitOf = (
    mode: SplitMode,
    amount: number | null,
    values: ReadonlyArray<{ memberId: string; value: number | null }>,
    seed: number
): { shares: Share[] | null; problem: SplitProblem | null } => {
    if (values.length === 0) return { shares: null, problem: { kind: 'nobody' } };
    const ids = values.map((item) => item.memberId);
    if (mode === 'equal') return { shares: amount === null ? null : splitEqually(amount, ids, seed), problem: null };
    // The amounts wait for the total they are typed against
    if (mode === 'exact' && amount === null) return { shares: null, problem: null };

    const invalid = values.filter((item) => item.value === null).map((item) => item.memberId);
    if (invalid.length > 0) return { shares: null, problem: { kind: 'invalid', ids: invalid } };
    const typed = values.map((item) => ({ memberId: item.memberId, value: item.value ?? 0 }));

    if (mode === 'percent') {
        const percents = typed.map((item) => ({ memberId: item.memberId, basisPoints: item.value }));
        const left = percentLeft(percents);
        if (left !== 0) return { shares: null, problem: { kind: 'left', left } };
        return { shares: amount === null ? null : splitByPercent(amount, percents, seed), problem: null };
    }

    const parts = typed.map((item) => ({ memberId: item.memberId, cents: item.value }));
    const left = unassignedCents(amount ?? 0, parts);
    if (left !== 0) return { shares: null, problem: { kind: 'left', left } };
    return { shares: splitExactly(amount ?? 0, parts), problem: null };
};

// Where the tail of an entry starts: its payer, its mode and who is in, with the percentages as its shares over the
// amount and the amounts as saved. A merged placeholder is read as its target, and somebody who left can't take part,
// so an edit keeps the saved shares only when everybody in them still can. A copy keeps none: its cents left are drawn.
const draftOfEntry = (group: SharedGroup, entry: SharedExpenseEntry, copy: boolean, locale: string): SharedDraft => {
    const present = group.members.filter((member) => member.leftAt === null).map((member) => member.id);
    const cents = new Map<string, number>();
    for (const share of entry.shares) {
        const memberId = canonicalMember(group.members, share.memberId);
        cents.set(memberId, (cents.get(memberId) ?? 0) + share.cents);
    }
    const inIds = present.filter((memberId) => cents.has(memberId));
    const shares = inIds.map((memberId) => ({ memberId, cents: cents.get(memberId)! }));
    const keptCents = shares.reduce((sum, share) => sum + share.cents, 0);
    const texts = (values: readonly number[]) =>
        Object.fromEntries(inIds.map((memberId, index) => [memberId, formatAmountInput(values[index]!, locale)]));

    const typed: TypedShares | null =
        entry.split === 'percent'
            ? {
                  key: inIds.join(),
                  values: texts(percentsOf(keptCents, shares).map((percent) => percent.basisPoints)),
              }
            : entry.split === 'exact'
              ? { key: `${entry.amountCents}:${inIds.join()}`, values: texts(shares.map((share) => share.cents)) }
              : null;

    return {
        groupId: group.id,
        paidBy: canonicalMember(group.members, entry.paidBy),
        mode: entry.split,
        out: present.filter((memberId) => !cents.has(memberId)),
        typed,
        saved: !copy && keptCents === entry.amountCents ? { amountCents: entry.amountCents, shares } : null,
    };
};

// The open groups, then the open friends, as the Groups tab lists them
const openChoices = (groups: readonly SharedGroup[]): SharedGroup[] => {
    return groupsFirst(groups.filter((group) => group.closed === null));
};

// The tail of a shared expense: the group or friend, who paid and how it is split, in cents. Given a group, it is
// shared there; otherwise in one of the person's open groups and friends. Given an entry of that group too, it starts
// from it.
const useSharedTail = (
    fixed: SharedGroup | undefined,
    totalCents: number | null,
    payment: PaymentState,
    source: EntrySource | null = null,
    startGroupId?: string
) => {
    const { groups } = useGroups();
    const { locale } = useLocale();
    const [initial] = useState<SharedDraft>(() =>
        fixed && source
            ? draftOfEntry(fixed, source.entry, source.copy, locale)
            : startGroupId
              ? { ...START, groupId: startGroupId }
              : START
    );
    const [draft, setDraft] = useState<SharedDraft>(initial);
    // Who paid and how it is split fold under a summary; they start open on a payer who is gone, to be chosen
    const [splitOpen, setSplitOpen] = useState(
        () =>
            initial.paidBy !== null &&
            !(fixed?.members.some((member) => member.id === initial.paidBy && member.leftAt === null) ?? false)
    );
    // Picks who gets the cents left of an equal split: drawn once per expense, so the amounts don't move as it is typed
    const [seed, setSeed] = useState(randomSeed);
    // The summary of the split, shown beside the tabs of the form, describes its toggle
    const summaryId = useId();
    const user = useUser();
    const [remembered] = useState(() => readSharedWith(user.id));
    const choices = useMemo(() => (fixed ? [fixed] : openChoices(groups)), [fixed, groups]);

    // The one picked, else the one used last, else the only one; with more and none of those, none is guessed (ADR-0034)
    const group =
        choices.find((item) => item.id === draft.groupId) ??
        choices.find((item) => item.id === remembered) ??
        (choices.length === 1 ? choices[0] : undefined);
    // Those who can take part: a member who left, or was merged, can't
    const present = group?.members.filter((member) => member.leftAt === null) ?? [];
    const me = group?.me ?? null;
    // As they are listed: the person first, the others in the order of the group
    const people = [...present.filter((member) => member.id === me), ...present.filter((member) => member.id !== me)];
    // Null is nobody yet: the one who paid is gone, and a payer is never guessed
    const payer = draft.paidBy === null ? me : (present.find((member) => member.id === draft.paidBy)?.id ?? null);
    const payerGone = draft.paidBy !== null && payer === null;
    const payerIsMe = payer !== null && payer === me;
    const inIds = present.filter((member) => !draft.out.includes(member.id)).map((member) => member.id);
    const amount = totalCents !== null && totalCents >= 1 ? totalCents : null;

    // The percentages start from 100 % split evenly, the amounts from the equal split, until one is typed
    const key = draft.mode === 'exact' ? `${amount}:${inIds.join()}` : inIds.join();
    const startTexts = (): string[] => {
        if (draft.mode === 'percent') {
            return equalPercents(inIds, seed).map((percent) => formatAmountInput(percent.basisPoints, locale));
        }
        if (amount === null) return inIds.map(() => '');
        const equally = splitEqually(amount, inIds, seed) ?? [];
        return inIds.map((memberId) =>
            formatAmountInput(equally.find((share) => share.memberId === memberId)?.cents ?? 0, locale)
        );
    };
    const texts: Readonly<Record<string, string>> =
        draft.mode === 'equal'
            ? {}
            : draft.typed?.key === key
              ? draft.typed.values
              : Object.fromEntries(startTexts().map((text, index) => [inIds[index]!, text]));
    const parse = draft.mode === 'percent' ? parsePercent : parseAmount;
    const split = splitOf(
        draft.mode,
        amount,
        inIds.map((memberId) => ({ memberId, value: parse(texts[memberId] ?? '', locale) })),
        seed
    );
    const kept = draft.saved !== null && draft.saved.amountCents === amount ? draft.saved.shares : null;
    const shares = kept ?? split.shares;
    const problem = kept ? null : split.problem;
    // The schema's rule: whoever pays by card has a share
    const cardWithoutYou =
        payerIsMe &&
        payment.payment !== 'direct' &&
        (shares ? !shares.some((share) => share.memberId === me) : !inIds.includes(me));
    const valid =
        group !== undefined &&
        payer !== null &&
        shares !== null &&
        shares.length > 0 &&
        problem === null &&
        !cardWithoutYou;

    // What each member who can take part shows: nothing when out or when their part comes to nothing; else, split
    // equally, their share once there is an amount, and otherwise what is typed for them
    const rows = people.map((member) => {
        const isIn = inIds.includes(member.id);
        const share = shares?.find((item) => item.memberId === member.id)?.cents ?? 0;
        return {
            id: member.id,
            isIn,
            cents: isIn && draft.mode === 'equal' && share > 0 ? share : null,
            text: isIn && draft.mode !== 'equal' ? (texts[member.id] ?? '') : null,
            invalid: problem?.kind === 'invalid' && problem.ids.includes(member.id),
        };
    });

    return {
        choices,
        group,
        people,
        summaryId,
        payer,
        payerGone,
        payerIsMe,
        cardWithoutYou,
        rows,
        mode: draft.mode,
        problem,
        valid,
        inCount: inIds.length,
        splitOpen,
        setSplitOpen,
        // Something to fix in what folds under the split
        splitProblem: group === undefined || payer === null || problem !== null || cardWithoutYou,
        // The day the payer's card charges it; only the payer says how they paid
        chargeDate: payerIsMe ? payment.chargeDate : null,
        pickGroup: (groupId: string) => setDraft({ ...START, mode: draft.mode, groupId }),
        // Somebody else pays now: only the payer says how they paid
        pickPayer: (memberId: string) => {
            setDraft({ ...draft, paidBy: memberId });
            if (memberId !== me) payment.reset();
        },
        pickMode: (mode: SplitMode) => setDraft({ ...draft, mode, typed: null, saved: null }),
        type: (memberId: string, text: string) => {
            setDraft({ ...draft, typed: { key, values: { ...texts, [memberId]: text } }, saved: null });
        },
        take: (memberId: string, isIn: boolean) => {
            const out = draft.out.filter((id) => id !== memberId);
            setDraft({ ...draft, out: isIn ? out : [...out, memberId], saved: null });
        },
        // The entry, with the group to write it in, while it can be saved. An edit keeps the id, the day it was made and
        // the card of a payer who isn't the person, and is later than the version it replaces (ADR-0005).
        entryOf: (head: SharedHead): { group: SharedGroup; entry: SharedEntry } | null => {
            if (!group || !valid || payer === null || shares === null) return null;
            const edited = source && !source.copy ? source.entry : null;
            const theirCard = edited !== null && !payerIsMe && payer === canonicalMember(group.members, edited.paidBy);
            const fields = {
                kind: 'expense' as const,
                ...head,
                paidBy: payer,
                split: draft.mode,
                shares,
                payment: payerIsMe ? payment.payment : theirCard ? edited.payment : 'direct',
                chargeDate: payerIsMe ? payment.chargeDate : theirCard ? edited.chargeDate : null,
            };
            if (!edited) return { group, entry: newEntry(group, fields) };
            const entry = {
                ...fields,
                id: edited.id,
                currency: edited.currency,
                createdAt: edited.createdAt,
                updatedAt: Math.max(Date.now(), edited.updatedAt + 1),
                deletedAt: null,
            };
            return { group, entry };
        },
        // Back to where it starts, in the same group, for a new expense with a seed of its own
        reset: () => {
            setDraft({ ...START, groupId: group?.id ?? null });
            setSeed(randomSeed());
            setSplitOpen(false);
        },
    };
};

const SharedTail = (props: SharedTailProps) => {
    const { tail, fixed, tried = false } = props;
    const t = useTranslations('groups');

    if (tail.choices.length === 0) {
        return (
            <Notice tone={tried ? 'danger' : 'quiet'} role={tried ? 'alert' : undefined}>
                {t('share.none')}
            </Notice>
        );
    }

    return <SharedSplit tail={tail} fixed={fixed} tried={tried} />;
};

// Who it is with, who paid and how it is split: a line that says them, and under it the toggle that opens them to
// change, With first (ADR-0034)
const SharedSplit = (props: Required<SharedTailProps>) => {
    const { tail, fixed, tried } = props;
    const t = useTranslations('groups.share');
    const options = useGroupOptions(tail.choices);
    const { group } = tail;
    const noneYet = group ? [] : [{ value: '', label: t('withNone') }];

    return (
        <div className="shared-split">
            <Disclosure
                chevron
                keepMounted
                inForm
                oneLine
                open={tail.splitOpen}
                summary={t('split')}
                hint={group ? <PaidBy group={group} tail={tail} /> : undefined}
                describedBy={tail.summaryId}
                onOpenChange={tail.setSplitOpen}
            >
                {!fixed && (
                    <Field label={t('with')} error={tried && !group ? t('withMissing') : null}>
                        {(control) => (
                            <Select
                                {...control}
                                options={[...noneYet, ...options]}
                                value={group?.id ?? ''}
                                onChange={(value) => {
                                    if (value !== '') tail.pickGroup(value);
                                }}
                            />
                        )}
                    </Field>
                )}
                {group && <SharedPeople group={group} tail={tail} tried={tried} />}
            </Disclosure>
        </div>
    );
};

// Who paid, said in the toggle of Split while it is closed (ADR-0034)
const PaidBy = (props: Omit<SharedPeopleProps, 'tried'>) => {
    const { group, tail } = props;
    const t = useTranslations('groups.share');
    const words = useGroupWords(group);

    if (tail.payer === null) return t('paidByNone');
    return tail.payerIsMe ? t('summary.youPaid') : t('summary.paid', { name: words.nameOf(tail.payer) });
};

// Who it is with and how it is split, a short line each, which the form shows beside its tabs (ADR-0034)
const SharedSummary = (props: SharedSummaryProps) => {
    const { tail } = props;
    const t = useTranslations('groups.share');

    if (tail.choices.length === 0) return null;

    return (
        <p className="shared-summary" id={tail.summaryId}>
            {tail.group ? <SummaryLines group={tail.group} tail={tail} /> : <Line>{t('withNone')}</Line>}
        </p>
    );
};

const SummaryLines = (props: Omit<SharedPeopleProps, 'tried'>) => {
    const { group, tail } = props;
    const t = useTranslations('groups.share');
    const words = useGroupWords(group);

    return (
        <>
            <Line>{t('summary.with', { name: words.title })}</Line>
            <Line>{t(`summary.${tail.mode}`, { count: tail.inCount })}</Line>
        </>
    );
};

// One line, cut when it doesn't fit; a pause between lines for a screen reader, which reads them as one
const Line = (props: LineProps) => {
    const { children } = props;

    return (
        <>
            <span className="shared-summary__line" title={children}>
                {children}
            </span>
            <span className="visually-hidden">. </span>
        </>
    );
};

// Who paid and who is in, with the share of each
const SharedPeople = (props: SharedPeopleProps) => {
    const { group, tail, tried } = props;
    const t = useTranslations('groups.share');
    const { locale } = useLocale();
    const words = useGroupWords(group);
    const id = useId();
    const { mode, problem } = tail;
    const byPercent = mode === 'percent';
    // Once Add was pressed, shares that don't add up are each marked, as what is left is an error then
    const sumBad = tried && problem?.kind === 'left';
    const nobodyYet = tail.payer === null ? [{ value: '', label: t('paidByNone') }] : [];
    const format = useMoney();
    const amountPlaceholder = useAmountPlaceholder();
    const money = (cents: number) => format(Math.abs(cents), group.currency);
    // The symbol the amounts are drawn with, the one the person chose for the app's currency
    const currencySign =
        format(0, group.currency)
            .split('')
            .filter((char) => !/[\d\s.,\u00a0\u202f-]/.test(char))
            .join('') || group.currency;
    const percentFormat = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }),
        [locale]
    );
    const percent = (basisPoints: number) => percentFormat.format(Math.abs(basisPoints) / HUNDRED_PERCENT);

    return (
        <>
            <Field
                label={t('paidBy')}
                hint={tail.payerGone && !tried ? t('payerLeft') : undefined}
                error={tried && tail.payer === null ? t('payerLeft') : null}
            >
                {(control) => (
                    <Select
                        {...control}
                        options={[
                            ...nobodyYet,
                            ...tail.people.map((member) => ({ value: member.id, label: words.nameInList(member.id) })),
                        ]}
                        value={tail.payer ?? ''}
                        onChange={(value) => {
                            if (value !== '') tail.pickPayer(value);
                        }}
                    />
                )}
            </Field>

            <fieldset className="shared-people">
                <legend className="shared-people__legend">{t('people')}</legend>
                {/* How it is split, by the sign of each mode, at the end of the row of the legend */}
                <div className="shared-people__modes" role="group" aria-label={t('mode')}>
                    {SPLIT_MODES.map((value) => (
                        <Button
                            key={value}
                            ghost
                            glyph
                            className="shared-people__mode"
                            aria-label={t(`modes.${value}`)}
                            aria-pressed={mode === value}
                            onClick={() => tail.pickMode(value)}
                        >
                            [{value === 'equal' ? '=' : value === 'percent' ? t('percentUnit') : currencySign}]
                        </Button>
                    ))}
                </div>
                <ul className="shared-people__list" role="list">
                    {tail.rows.map((row) => (
                        <li key={row.id} className="shared-people__row">
                            <Checkbox
                                label={words.nameInList(row.id)}
                                checked={row.isIn}
                                onChange={(checked) => tail.take(row.id, checked)}
                            />
                            {row.cents !== null && <span>{money(row.cents)}</span>}
                            {row.text !== null && (
                                <FieldBox suffix={byPercent ? t('percentUnit') : undefined}>
                                    <input
                                        className="shared-people__input"
                                        aria-describedby={
                                            row.invalid ? `${id}-invalid` : sumBad ? `${id}-left` : undefined
                                        }
                                        aria-invalid={row.invalid || sumBad}
                                        aria-label={t(byPercent ? 'percentOf' : 'amountOf', {
                                            name: words.nameInList(row.id),
                                        })}
                                        autoComplete="off"
                                        inputMode="decimal"
                                        placeholder={byPercent ? '0' : amountPlaceholder}
                                        type="text"
                                        value={row.text}
                                        onChange={(event) => tail.type(row.id, event.target.value)}
                                    />
                                </FieldBox>
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
            {problem?.kind === 'left' && problem.left > 0 && tried && (
                <Notice tone="danger" role="alert" id={`${id}-left`}>
                    {byPercent
                        ? t('percentLeft', { percent: percent(problem.left) })
                        : t('unassigned', { amount: money(problem.left) })}
                </Notice>
            )}
            <SpokenHint>
                {problem?.kind === 'left' &&
                    problem.left > 0 &&
                    !tried &&
                    (byPercent
                        ? t('percentLeft', { percent: percent(problem.left) })
                        : t('unassigned', { amount: money(problem.left) }))}
            </SpokenHint>
            {problem?.kind === 'left' && problem.left < 0 && (
                <Notice tone="danger" role="alert" id={`${id}-left`}>
                    {byPercent
                        ? t('percentOver', { percent: percent(problem.left) })
                        : t('over', { amount: money(problem.left) })}
                </Notice>
            )}
        </>
    );
};

// How the person paid, only when they did; the form folds it under More options
const SharedPayment = (props: SharedPaymentProps) => {
    const { tail, payment } = props;
    const t = useTranslations('groups.share');

    if (!tail.group || !tail.payerIsMe) return null;

    return (
        <PaymentFields
            label={t('howYouPaid')}
            hint={t('othersNow')}
            error={tail.cardWithoutYou ? t('cardNeedsYou') : null}
            state={payment}
        />
    );
};

export {
    SharedPayment,
    SharedSummary,
    SharedTail,
    useSharedTail,
    type EntrySource,
    type SharedPaymentProps,
    type SharedSummaryProps,
    type SharedTailProps,
    type SharedTailState,
};
