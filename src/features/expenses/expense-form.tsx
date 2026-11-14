import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { useBudgetWarning } from '@/features/budgets/use-budget-warning';
import { CategorySelect } from '@/features/categories/category-select';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { failureOf, useFailureWords } from '@/features/groups/group-failure';
import { SharedPayment, SharedTail, useSharedTail } from '@/features/groups/shared-tail';
import { useEntryActions } from '@/features/groups/use-entry-actions';
import { sharedRowsOf } from '@/features/groups/use-shared-expense-rows';
import { useUser } from '@/lib/auth';
import { useLocale } from '@/lib/i18n';
import { rememberSharedWith } from '@/lib/offline';
import { FALLBACK_CATEGORY_ID, isDefaultCategoryId } from '@core/categories';
import { toDateString } from '@core/date';
import { TEXT_MAX_LENGTH, type Payment } from '@core/expense';
import { formatAmountInput, parseAmount } from '@core/money';
import { canonicalMember } from '@core/shared-member';

import { createExpenses, draftOf, reviseExpenses, type Draft } from './create-expenses';
import { usePayment } from './payment-fields';
import { PersonalTail, usePersonalTail, type TypedParts } from './personal-tail';
import { useSaveExpense } from './use-save-expense';
import { useShortDate } from './use-short-date';
import { useSuggestCategory } from './use-suggest-category';

import type { Expense } from '@core/expense';
import type { SharedExpenseEntry } from '@core/shared-expense';
import type { SharedGroup } from '@core/shared-group';

import './expense-form.css';

// Who the expense is for: the person alone, or shared in a group or with a friend
type ForWhom = 'me' | 'shared';

interface ExpenseFormProps {
    // The id of the form, which the button that sends it names from the foot of the sheet around it
    id: string;
    // Its name, which the sheet around it (ExpenseSheet) shows too
    title: string;
    // The group of the screen the form is on, where the expense is shared with nothing to choose
    group?: SharedGroup;
    // Where a new expense starts shared, a group or friend the person can still change; without it, it starts as Just me
    startGroup?: SharedGroup;
    // The expense, or every part of its plan, to change; without it the form adds a new one
    editing?: readonly Expense[] | null;
    // The expense, or every part of its plan, to start a new one from
    copying?: readonly Expense[] | null;
    // A shared expense of the group to change, or to start a new one from
    editingEntry?: SharedExpenseEntry | null;
    copyingEntry?: SharedExpenseEntry | null;
    // After an edit or a copy is saved or cancelled
    onDone?: () => void;
    // Called once a new expense is saved, not an edit, with the day it was made
    onAdded?: (day: string) => void;
    // Told whether a new expense holds a draft worth keeping: an amount or a description
    onDraftChange?: (drafting: boolean) => void;
}

interface StartingFields {
    amount: string;
    text: string;
    // The category an edited expense was saved with
    categoryId: string | null;
    date: string;
    payment: Payment;
    chargeDate: string | null;
    personal: string;
    installments: number;
    parts: TypedParts | null;
}

// What the fields start with: empty for a new expense, what was saved for one being edited. A copy has the same, but
// made today and, when it is deferred, charged on the day the form proposes.
const startingFields = (draft: Draft | null, locale: string, copy: boolean): StartingFields => {
    if (!draft) {
        return {
            amount: '',
            text: '',
            categoryId: null,
            date: toDateString(new Date()),
            payment: 'direct',
            chargeDate: null,
            personal: '',
            installments: 1,
            parts: null,
        };
    }

    const totalCents = draft.amounts.reduce((sum, cents) => sum + cents, 0);
    const count = draft.amounts.length;
    return {
        amount: formatAmountInput(totalCents, locale),
        text: draft.text,
        categoryId: draft.categoryId,
        date: copy ? toDateString(new Date()) : draft.date,
        payment: draft.payment,
        chargeDate: copy ? null : draft.chargeDate,
        personal: draft.personalCents === null ? '' : formatAmountInput(draft.personalCents, locale),
        installments: count,
        // The saved parts, which an even split would lose when they aren't even
        parts:
            count > 1
                ? {
                      key: `${totalCents}:${count}`,
                      values: draft.amounts.map((cents) => formatAmountInput(cents, locale)),
                  }
                : null,
    };
};

// What the fields start with for a shared expense of the group: a copy is made today, and only the payer's card is
// theirs to keep, its charge date proposed again for the copy
const entryFields = (group: SharedGroup, entry: SharedExpenseEntry, locale: string, copy: boolean): StartingFields => {
    const payerIsMe = canonicalMember(group.members, entry.paidBy) === group.me;
    return {
        amount: formatAmountInput(entry.amountCents, locale),
        text: entry.text,
        categoryId: entry.categoryId,
        date: copy ? toDateString(new Date()) : entry.date,
        payment: payerIsMe ? entry.payment : 'direct',
        chargeDate: payerIsMe && !copy ? entry.chargeDate : null,
        personal: '',
        installments: 1,
        parts: null,
    };
};

// The head (amount, description, category, day) is common; under it, For chooses the tail. Each tail keeps what was
// typed in it while the form is open, so switching back and forth loses nothing.
const ExpenseForm = (props: ExpenseFormProps) => {
    const {
        id: formId,
        title,
        group,
        startGroup,
        editing = null,
        copying = null,
        editingEntry = null,
        copyingEntry = null,
        onDone,
        onAdded,
        onDraftChange,
    } = props;
    const t = useTranslations('expenses.form');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const user = useUser();
    const save = useSaveExpense();
    const { save: saveEntry } = useEntryActions();
    const warn = useBudgetWarning();
    const failureWords = useFailureWords();
    const { options } = useCategoryOptions();
    const id = useId();

    // A form edits or copies one expense for its whole life: a new one is mounted for another (ExpenseSheet)
    const source = editing ?? copying;
    const entry = editingEntry ?? copyingEntry;
    const [entrySource] = useState(() => (entry ? { entry, copy: copyingEntry !== null } : null));
    const [start] = useState(() =>
        group && entry
            ? entryFields(group, entry, locale, copyingEntry !== null)
            : startingFields(source && draftOf(source), locale, copying !== null)
    );
    const startFor: ForWhom = group || startGroup ? 'shared' : 'me';
    const suggest = useSuggestCategory(source === null && entry === null);
    const [amount, setAmount] = useState(start.amount);
    const [text, setText] = useState(start.text);
    const [picked, setPicked] = useState<string | null>(null);
    const [date, setDate] = useState(start.date);
    const [forWhom, setForWhom] = useState<ForWhom>(startFor);
    const [amountInvalid, setAmountInvalid] = useState(false);
    const [dateInvalid, setDateInvalid] = useState(false);
    // Add was pressed with something to fix: what was a quiet line while typing is said as an error until it is saved
    const [tried, setTried] = useState(false);
    // Asks the first marked field for the focus once the marks are drawn
    const [focusAsk, setFocusAsk] = useState(0);
    // What a new expense starts with is folded; an edit or a copy that holds something else starts open (ADR-0026)
    const [optionsOpen, setOptionsOpen] = useState(
        () => start.date !== toDateString(new Date()) || start.payment !== 'direct' || start.installments > 1
    );
    const formRef = useRef<HTMLFormElement>(null);
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<'saveFailed' | 'readOnly' | null>(null);

    const drafting = source === null && entry === null && (amount.trim() !== '' || text.trim() !== '');
    useEffect(() => {
        onDraftChange?.(drafting);
        return () => onDraftChange?.(false);
    }, [drafting, onDraftChange]);

    const totalCents = parseAmount(amount, locale);
    const payment = usePayment(start, date);
    const personal = usePersonalTail(start, totalCents, date, payment.payment);
    const shared = useSharedTail(group, totalCents, payment, entrySource, startGroup?.id);
    const isShared = forWhom === 'shared';

    // A new expense's category follows the description until the user picks one (the keywords, else the person's own
    // history); an edited one keeps what was saved, even an id with no category behind it any more, which shows as the
    // fallback. A pick that has since been deleted no longer counts. A shared expense takes a default category only,
    // which everybody in the group has: a custom one stands aside for the suggestion while it is shared.
    const categories = isShared ? options.filter((option) => isDefaultCategoryId(option.id)) : options;
    const offered = (id: string | null) => categories.some((option) => option.id === id);
    const own = options.some((option) => option.id === picked) ? picked : null;
    const customAside = isShared && (own ?? start.categoryId) !== null && !isDefaultCategoryId(own ?? start.categoryId);
    const suggested = suggest(text);
    const suggestion = isShared && !isDefaultCategoryId(suggested) ? FALLBACK_CATEGORY_ID : suggested;
    const pick = offered(picked) ? picked : null;
    const saved =
        start.categoryId !== null && (!isShared || isDefaultCategoryId(start.categoryId)) ? start.categoryId : null;
    const categoryId = pick ?? saved ?? suggestion;
    const shownCategory = offered(categoryId) ? categoryId : FALLBACK_CATEGORY_ID;
    const showSuggestion = start.categoryId === null && pick === null && suggestion !== FALLBACK_CATEGORY_ID;

    // The first field marked, else the first message of a problem, comes into view with the focus when it can take it
    useEffect(() => {
        if (focusAsk === 0) return;
        const form = formRef.current;
        if (!form) return;
        const marked = form.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (marked) {
            marked.focus();
            marked.scrollIntoView?.({ block: 'center' });
            return;
        }
        form.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView?.({ block: 'center' });
    }, [focusAsk]);

    const today = toDateString(new Date());
    const paymentWords = isShared && !shared.payerIsMe ? null : tPayment(payment.payment);
    const optionsSummary = [
        date === today ? t('today') : date ? shortDate(date) : null,
        paymentWords,
        !isShared && personal.parts > 1 ? t('installmentsOption', { count: personal.parts }) : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const resetForm = () => {
        setAmount('');
        setText('');
        setPicked(null);
        payment.reset();
        personal.reset();
        shared.reset();
        setForWhom(startFor);
        setTried(false);
        setOptionsOpen(false);
    };

    const savePersonal = async (amountCents: number) => {
        const draft: Draft = {
            categoryId,
            text: text.trim(),
            date,
            payment: payment.payment,
            chargeDate: payment.chargeDate,
            personalCents: personal.personalCents,
            amounts: personal.amounts(amountCents),
        };
        const expenses = editing ? reviseExpenses(editing, draft) : createExpenses(draft, copying?.[0]?.currency);
        try {
            await save(expenses);
            if (editing) {
                onDone?.();
                return;
            }
            onAdded?.(date);
            warn(expenses);
            if (copying) {
                onDone?.();
                return;
            }
            resetForm();
        } catch {
            setFailure('saveFailed');
        }
    };

    const saveShared = async (amountCents: number) => {
        const write = shared.entryOf({ text: text.trim(), categoryId, amountCents, date });
        if (!write) return;
        try {
            await saveEntry(write.group.id, write.entry);
            if (editingEntry) {
                onDone?.();
                return;
            }
            onAdded?.(date);
            warn(sharedRowsOf(write.group, [write.entry]));
            rememberSharedWith(user.id, write.group.id);
            if (copyingEntry) {
                onDone?.();
                return;
            }
            resetForm();
        } catch (error) {
            setFailure(failureOf(error) === 'readOnly' ? 'readOnly' : 'saveFailed');
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (saving) return;

        // Every problem is marked at once, each on its own field
        const amountCents = totalCents;
        const amountBad = amountCents === null || amountCents < 1;
        const tailBad = isShared ? !shared.valid : !personal.check();
        const chargeDate = isShared ? shared.chargeDate : payment.chargeDate;
        const dateBad = date === '';
        const chargeBad = !dateBad && chargeDate !== null && chargeDate < date;
        setAmountInvalid(amountBad);
        setDateInvalid(dateBad);
        payment.setChargeInvalid(chargeBad);
        if (amountBad || dateBad || tailBad || chargeBad) {
            const optionsBad = dateBad || chargeBad || (isShared ? shared.cardWithoutYou : personal.optionsProblem);
            if (optionsBad) setOptionsOpen(true);
            setTried(true);
            setFailure(null);
            setFocusAsk((ask) => ask + 1);
            return;
        }

        setFailure(null);
        setSaving(true);
        try {
            await (isShared ? saveShared(amountCents) : savePersonal(amountCents));
        } finally {
            setSaving(false);
        }
    };

    // The sheet around it shows its title and the button that sends it (ExpenseSheet)
    return (
        <form
            ref={formRef}
            className="expense-form"
            id={formId}
            aria-label={title}
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
        >
            <Field label={t('amount')} error={amountInvalid ? t('amountInvalid') : null}>
                {(control) => (
                    <input
                        {...control}
                        autoComplete="off"
                        inputMode="decimal"
                        type="text"
                        value={amount}
                        onChange={(event) => {
                            setAmount(event.target.value);
                            setAmountInvalid(false);
                        }}
                    />
                )}
            </Field>

            <Field label={t('text')}>
                {(control) => (
                    <input
                        {...control}
                        autoComplete="off"
                        maxLength={TEXT_MAX_LENGTH}
                        type="text"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                    />
                )}
            </Field>

            <Field
                label={t('category')}
                hint={customAside ? t('customShared') : showSuggestion ? t('suggested') : undefined}
            >
                {(control) => (
                    <CategorySelect {...control} options={categories} value={shownCategory} onChange={setPicked} />
                )}
            </Field>

            {/* An edit keeps an expense of one person as it is */}
            {!group && !editing && (
                <ChoiceGroup
                    legend={t('for')}
                    name={`${id}-for`}
                    options={[
                        { value: 'me', label: t('forMe') },
                        { value: 'shared', label: t('forShared') },
                    ]}
                    value={forWhom}
                    onChange={setForWhom}
                />
            )}

            {isShared && <SharedTail tail={shared} fixed={group !== undefined} tried={tried} />}

            <Disclosure
                className="expense-form__options"
                chevron
                keepMounted
                open={optionsOpen}
                summary={
                    <span className="expense-form__options-summary">
                        <span>{t('moreOptions')}</span>
                        {!optionsOpen && optionsSummary && (
                            <span className="expense-form__options-values">{optionsSummary}</span>
                        )}
                    </span>
                }
                onOpenChange={setOptionsOpen}
            >
                <Field label={t('date')} error={dateInvalid ? t('dateInvalid') : null}>
                    {(control) => (
                        <input
                            {...control}
                            type="date"
                            value={date}
                            onChange={(event) => {
                                setDate(event.target.value);
                                setDateInvalid(false);
                                payment.setChargeInvalid(false);
                            }}
                        />
                    )}
                </Field>

                {isShared ? (
                    <SharedPayment tail={shared} payment={payment} />
                ) : (
                    <PersonalTail tail={personal} payment={payment} tried={tried} />
                )}
            </Disclosure>

            {failure && !amountInvalid && (
                <Notice tone="danger" role="alert">
                    {failure === 'readOnly' ? failureWords('readOnly') : t('saveFailed')}
                </Notice>
            )}
        </form>
    );
};

export { ExpenseForm, type ExpenseFormProps };
