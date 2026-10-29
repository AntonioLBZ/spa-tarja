import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { CategorySelect } from '@/features/categories/category-select';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import { suggestCategory } from '@core/classifier';
import { addMonths, toDateString } from '@core/date';
import { PAYMENTS, TEXT_MAX_LENGTH, type Payment } from '@core/expense';
import { installmentDates, planBalance, splitEvenly } from '@core/installments';
import { DEFAULT_CURRENCY, formatAmount, formatAmountInput, parseAmount } from '@core/money';

import { createExpenses, draftOf, reviseExpenses, type Draft } from './create-expenses';
import { useSaveExpense } from './use-save-expense';
import { useShortDate } from './use-short-date';

import type { Expense } from '@core/expense';

import './expense-form.css';

// A year of monthly payments; the data allows longer plans (core/installments)
const INSTALLMENT_CHOICES = Array.from({ length: 12 }, (_, index) => index + 1);

interface ExpenseFormProps {
    // Its name, which the heading over it (AddExpense) shows too
    title: string;
    // The expense, or every part of its plan, to change; without it the form adds a new one
    editing?: readonly Expense[] | null;
    // The expense, or every part of its plan, to start a new one from
    copying?: readonly Expense[] | null;
    // After an edit or a copy is saved or cancelled
    onDone?: () => void;
    // Called once a new expense is saved, not an edit
    onAdded?: () => void;
}

// What the person typed in the parts, valid only for the total and the count it was typed for
interface TypedParts {
    key: string;
    values: string[];
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
function startingFields(draft: Draft | null, locale: string, copy: boolean): StartingFields {
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
}

function ExpenseForm(props: ExpenseFormProps) {
    const { title, editing = null, copying = null, onDone, onAdded } = props;
    const t = useTranslations('expenses.form');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const save = useSaveExpense();
    const { options } = useCategoryOptions();
    const id = useId();

    // A form edits or copies one expense for its whole life: a new one is mounted for another (AddExpense)
    const source = editing ?? copying;
    const [start] = useState(() => startingFields(source && draftOf(source), locale, copying !== null));
    const [amount, setAmount] = useState(start.amount);
    const [text, setText] = useState(start.text);
    const [picked, setPicked] = useState<string | null>(null);
    const [date, setDate] = useState(start.date);
    const [payment, setPayment] = useState(start.payment);
    const [pickedCharge, setPickedCharge] = useState(start.chargeDate);
    const [personal, setPersonal] = useState(start.personal);
    const [installments, setInstallments] = useState(start.installments);
    const [editedParts, setEditedParts] = useState<TypedParts | null>(start.parts);
    const [chargeInvalid, setChargeInvalid] = useState(false);
    const [amountInvalid, setAmountInvalid] = useState(false);
    const [personalInvalid, setPersonalInvalid] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    // A new expense's category follows the description until the user picks one; an edited one keeps what was saved,
    // even an id with no category behind it any more, which shows as the fallback. A pick that has since been deleted
    // no longer counts.
    const suggestion = suggestCategory(text);
    const pick = options.some((option) => option.id === picked) ? picked : null;
    const categoryId = pick ?? start.categoryId ?? suggestion;
    const shownCategory = options.some((option) => option.id === categoryId) ? categoryId : FALLBACK_CATEGORY_ID;
    const showSuggestion = start.categoryId === null && pick === null && suggestion !== FALLBACK_CATEGORY_ID;
    // The number of payments of a plan edited here, when it is longer than the form offers
    const installmentChoices = INSTALLMENT_CHOICES.includes(start.installments)
        ? INSTALLMENT_CHOICES
        : [...INSTALLMENT_CHOICES, start.installments];
    // A deferred expense is charged a month after it was made unless the person picks the day
    const chargeDate = payment === 'direct' ? null : (pickedCharge ?? addMonths(date, 1));

    // Only what is paid at once can be split: a deferred expense is already charged on a day of its own
    const parts = payment === 'direct' ? installments : 1;
    const totalCents = parseAmount(amount, locale);
    const planDates = installmentDates(date, parts);
    // Your part of what a restaurant card paid, when others pay you back the rest; empty is the whole amount
    const personalText = payment === 'voucher' ? personal.trim() : '';
    const personalCents = personalText === '' ? null : parseAmount(personalText, locale);
    const personalOver = personalCents !== null && totalCents !== null && personalCents > totalCents;
    const paidBack = personalCents !== null && totalCents !== null ? totalCents - personalCents : 0;
    const partsKey = `${totalCents}:${parts}`;
    const partTexts =
        editedParts?.key === partsKey
            ? editedParts.values
            : totalCents === null
              ? []
              : splitEvenly(totalCents, parts).map((cents) => formatAmountInput(cents, locale));
    const partCents = partTexts.map((value) => parseAmount(value, locale));
    const balance =
        totalCents === null
            ? 0
            : planBalance(
                  totalCents,
                  partCents.map((cents) => cents ?? 0)
              );
    const partsProblem =
        parts === 1
            ? null
            : partCents.some((cents) => cents === null || cents < 1)
              ? 'invalid'
              : balance < 0
                ? 'over'
                : balance > 0
                  ? 'remaining'
                  : null;

    function editPart(index: number, value: string) {
        setEditedParts({ key: partsKey, values: partTexts.map((text, at) => (at === index ? value : text)) });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const amountCents = totalCents;
        if (amountCents === null || amountCents < 1) {
            setAmountInvalid(true);
            return;
        }

        if (partsProblem !== null) return;

        if (personalText !== '' && personalCents === null) {
            setPersonalInvalid(true);
            return;
        }

        if (personalOver) return;

        if (chargeDate !== null && chargeDate < date) {
            setChargeInvalid(true);
            return;
        }

        setAmountInvalid(false);
        setPersonalInvalid(false);
        setChargeInvalid(false);
        setSaveFailed(false);
        setSaving(true);
        const draft: Draft = {
            categoryId,
            text: text.trim(),
            date,
            payment,
            chargeDate,
            personalCents,
            amounts: parts === 1 ? [amountCents] : partCents.filter((cents) => cents !== null),
        };
        const expenses = editing ? reviseExpenses(editing, draft) : createExpenses(draft, copying?.[0]?.currency);
        try {
            await save(expenses);
            if (editing) {
                onDone?.();
                return;
            }
            onAdded?.();
            if (copying) {
                onDone?.();
                return;
            }
            setAmount('');
            setText('');
            setPicked(null);
            setPayment('direct');
            setPickedCharge(null);
            setPersonal('');
            setInstallments(1);
            setEditedParts(null);
        } catch {
            setSaveFailed(true);
        } finally {
            setSaving(false);
        }
    }

    // Its visible title is the heading that collapses it (AddExpense)
    return (
        <form className="expense-form" aria-label={title} onSubmit={(event) => void handleSubmit(event)}>
            <Field label={t('amount')} error={amountInvalid ? t('amountInvalid') : null}>
                {(control) => (
                    <input
                        {...control}
                        autoComplete="off"
                        inputMode="decimal"
                        required
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

            <Field label={t('category')} hint={showSuggestion ? t('suggested') : undefined}>
                {(control) => (
                    <CategorySelect
                        {...control}
                        label={t('category')}
                        options={options}
                        value={shownCategory}
                        onChange={setPicked}
                    />
                )}
            </Field>

            <Field label={t('date')}>
                {(control) => (
                    <input
                        {...control}
                        required
                        type="date"
                        value={date}
                        onChange={(event) => {
                            setDate(event.target.value);
                            setChargeInvalid(false);
                        }}
                    />
                )}
            </Field>

            <Field label={t('payment')}>
                {(control) => (
                    <select
                        {...control}
                        value={payment}
                        onChange={(event) => {
                            const next = event.target.value as Payment;
                            setPayment(next);
                            setChargeInvalid(false);
                            if (next !== 'voucher') {
                                setPersonal('');
                                setPersonalInvalid(false);
                            }
                        }}
                    >
                        {PAYMENTS.map((kind) => (
                            <option key={kind} value={kind}>
                                {tPayment(kind)}
                            </option>
                        ))}
                    </select>
                )}
            </Field>

            {chargeDate !== null && (
                <Field label={t('chargeDate')} error={chargeInvalid ? t('chargeDateInvalid') : null}>
                    {(control) => (
                        <input
                            {...control}
                            required
                            type="date"
                            value={chargeDate}
                            onChange={(event) => {
                                setPickedCharge(event.target.value);
                                setChargeInvalid(false);
                            }}
                        />
                    )}
                </Field>
            )}

            {payment === 'voucher' && (
                <Field
                    label={t('personal')}
                    hint={
                        paidBack > 0
                            ? t('paidBack', { amount: formatAmount(paidBack, DEFAULT_CURRENCY, locale) })
                            : undefined
                    }
                    error={personalOver ? t('personalOver') : personalInvalid ? t('personalInvalid') : null}
                >
                    {(control) => (
                        <input
                            {...control}
                            autoComplete="off"
                            inputMode="decimal"
                            type="text"
                            value={personal}
                            onChange={(event) => {
                                setPersonal(event.target.value);
                                setPersonalInvalid(false);
                            }}
                        />
                    )}
                </Field>
            )}

            {payment === 'direct' && (
                <Field label={t('installments')}>
                    {(control) => (
                        <select
                            {...control}
                            value={installments}
                            onChange={(event) => setInstallments(Number(event.target.value))}
                        >
                            {installmentChoices.map((count) => (
                                <option key={count} value={count}>
                                    {t('installmentsOption', { count })}
                                </option>
                            ))}
                        </select>
                    )}
                </Field>
            )}

            {parts > 1 &&
                partTexts.map((value, index) => (
                    <Field
                        key={planDates[index]}
                        label={t('part', { part: index + 1, parts, date: shortDate(planDates[index]!) })}
                        describedBy={partsProblem === 'invalid' ? `${id}-parts-error` : undefined}
                    >
                        {(control) => (
                            <input
                                {...control}
                                // The one message under the parts speaks for all of them
                                aria-invalid={partCents[index] === null || partCents[index]! < 1}
                                autoComplete="off"
                                inputMode="decimal"
                                required
                                type="text"
                                value={value}
                                onChange={(event) => editPart(index, event.target.value)}
                            />
                        )}
                    </Field>
                ))}

            {partsProblem === 'invalid' && (
                <Notice tone="danger" role="alert" id={`${id}-parts-error`}>
                    {t('partInvalid')}
                </Notice>
            )}
            {partsProblem === 'over' && (
                <Notice tone="danger" role="alert">
                    {t('over', { amount: formatAmount(-balance, DEFAULT_CURRENCY, locale) })}
                </Notice>
            )}
            {partsProblem === 'remaining' && (
                <p className="field__hint" role="status">
                    {t('remaining', { amount: formatAmount(balance, DEFAULT_CURRENCY, locale) })}
                </p>
            )}

            {saveFailed && !amountInvalid && (
                <Notice tone="danger" role="alert">
                    {t('saveFailed')}
                </Notice>
            )}

            <div className="expense-form__actions">
                <Button
                    className="expense-form__submit"
                    variant="primary"
                    disabled={saving || partsProblem !== null}
                    type="submit"
                >
                    {editing ? t('save') : t('submit')}
                </Button>
                {(editing || copying) && <Button onClick={onDone}>{t('cancel')}</Button>}
            </div>
        </form>
    );
}

export { ExpenseForm };
