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

import { createExpenses } from './create-expenses';
import { useSaveExpense } from './use-save-expense';
import { useShortDate } from './use-short-date';

import './expense-form.css';

// A year of monthly payments; the data allows longer plans (core/installments)
const INSTALLMENT_CHOICES = Array.from({ length: 12 }, (_, index) => index + 1);

function ExpenseForm() {
    const t = useTranslations('expenses.form');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const save = useSaveExpense();
    const { options } = useCategoryOptions();
    const id = useId();

    const [amount, setAmount] = useState('');
    const [text, setText] = useState('');
    const [picked, setPicked] = useState<string | null>(null);
    const [date, setDate] = useState(() => toDateString(new Date()));
    const [payment, setPayment] = useState<Payment>('direct');
    const [pickedCharge, setPickedCharge] = useState<string | null>(null);
    const [installments, setInstallments] = useState(1);
    // What the person typed in the parts, valid only for the total and the count it was typed for
    const [editedParts, setEditedParts] = useState<{ key: string; values: string[] } | null>(null);
    const [chargeInvalid, setChargeInvalid] = useState(false);
    const [amountInvalid, setAmountInvalid] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    // The category follows the description until the user picks one; a pick that has since been deleted no longer counts
    const suggestion = suggestCategory(text);
    const pick = options.some((option) => option.id === picked) ? picked : null;
    const categoryId = pick ?? suggestion;
    const showSuggestion = pick === null && suggestion !== FALLBACK_CATEGORY_ID;
    // A deferred expense is charged a month after it was made unless the person picks the day
    const chargeDate = payment === 'direct' ? null : (pickedCharge ?? addMonths(date, 1));

    // Only what is paid at once can be split: a deferred expense is already charged on a day of its own
    const parts = payment === 'direct' ? installments : 1;
    const totalCents = parseAmount(amount, locale);
    const planDates = installmentDates(date, parts);
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

        if (chargeDate !== null && chargeDate < date) {
            setChargeInvalid(true);
            return;
        }

        setAmountInvalid(false);
        setChargeInvalid(false);
        setSaveFailed(false);
        setSaving(true);
        const expenses = createExpenses({
            categoryId,
            text: text.trim(),
            date,
            payment,
            chargeDate,
            amounts: parts === 1 ? [amountCents] : partCents.filter((cents) => cents !== null),
        });
        try {
            await save(expenses);
            setAmount('');
            setText('');
            setPicked(null);
            setPayment('direct');
            setPickedCharge(null);
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
        <form className="expense-form" aria-label={t('title')} onSubmit={(event) => void handleSubmit(event)}>
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
                        value={categoryId}
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
                            setPayment(event.target.value as Payment);
                            setChargeInvalid(false);
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

            {payment === 'direct' && (
                <Field label={t('installments')}>
                    {(control) => (
                        <select
                            {...control}
                            value={installments}
                            onChange={(event) => setInstallments(Number(event.target.value))}
                        >
                            {INSTALLMENT_CHOICES.map((count) => (
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
                <p className="expense-form__hint" role="status">
                    {t('remaining', { amount: formatAmount(balance, DEFAULT_CURRENCY, locale) })}
                </p>
            )}

            {saveFailed && !amountInvalid && (
                <Notice tone="danger" role="alert">
                    {t('saveFailed')}
                </Notice>
            )}

            <Button variant="primary" disabled={saving || partsProblem !== null} type="submit">
                {t('submit')}
            </Button>
        </form>
    );
}

export { ExpenseForm };
