import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

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

    return (
        <form className="expense-form" aria-labelledby={`${id}-title`} onSubmit={(event) => void handleSubmit(event)}>
            <h2 className="expense-form__title" id={`${id}-title`}>
                {t('title')}
            </h2>

            <div className="expense-form__field">
                <label htmlFor={`${id}-amount`}>{t('amount')}</label>
                <input
                    id={`${id}-amount`}
                    aria-describedby={amountInvalid ? `${id}-error` : undefined}
                    aria-invalid={amountInvalid}
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
            </div>

            <div className="expense-form__field">
                <label htmlFor={`${id}-text`}>{t('text')}</label>
                <input
                    id={`${id}-text`}
                    autoComplete="off"
                    maxLength={TEXT_MAX_LENGTH}
                    type="text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                />
            </div>

            <div className="expense-form__field">
                <label htmlFor={`${id}-category`}>{t('category')}</label>
                <CategorySelect
                    id={`${id}-category`}
                    label={t('category')}
                    options={options}
                    value={categoryId}
                    onChange={setPicked}
                />
                {showSuggestion && <p className="expense-form__hint">{t('suggested')}</p>}
            </div>

            <div className="expense-form__field">
                <label htmlFor={`${id}-date`}>{t('date')}</label>
                <input
                    id={`${id}-date`}
                    required
                    type="date"
                    value={date}
                    onChange={(event) => {
                        setDate(event.target.value);
                        setChargeInvalid(false);
                    }}
                />
            </div>

            <div className="expense-form__field">
                <label htmlFor={`${id}-payment`}>{t('payment')}</label>
                <select
                    id={`${id}-payment`}
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
            </div>

            {chargeDate !== null && (
                <div className="expense-form__field">
                    <label htmlFor={`${id}-charge`}>{t('chargeDate')}</label>
                    <input
                        id={`${id}-charge`}
                        aria-describedby={chargeInvalid ? `${id}-charge-error` : undefined}
                        aria-invalid={chargeInvalid}
                        required
                        type="date"
                        value={chargeDate}
                        onChange={(event) => {
                            setPickedCharge(event.target.value);
                            setChargeInvalid(false);
                        }}
                    />
                </div>
            )}

            {payment === 'direct' && (
                <div className="expense-form__field">
                    <label htmlFor={`${id}-installments`}>{t('installments')}</label>
                    <select
                        id={`${id}-installments`}
                        value={installments}
                        onChange={(event) => setInstallments(Number(event.target.value))}
                    >
                        {INSTALLMENT_CHOICES.map((count) => (
                            <option key={count} value={count}>
                                {t('installmentsOption', { count })}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {parts > 1 &&
                partTexts.map((value, index) => (
                    <div className="expense-form__field" key={planDates[index]}>
                        <label htmlFor={`${id}-part-${index}`}>
                            {t('part', { part: index + 1, parts, date: shortDate(planDates[index]!) })}
                        </label>
                        <input
                            id={`${id}-part-${index}`}
                            aria-describedby={partsProblem === 'invalid' ? `${id}-parts-error` : undefined}
                            aria-invalid={partCents[index] === null || partCents[index]! < 1}
                            autoComplete="off"
                            inputMode="decimal"
                            required
                            type="text"
                            value={value}
                            onChange={(event) => editPart(index, event.target.value)}
                        />
                    </div>
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

            {amountInvalid && (
                <Notice tone="danger" role="alert" id={`${id}-error`}>
                    {t('amountInvalid')}
                </Notice>
            )}
            {chargeInvalid && (
                <Notice tone="danger" role="alert" id={`${id}-charge-error`}>
                    {t('chargeDateInvalid')}
                </Notice>
            )}
            {saveFailed && !amountInvalid && (
                <Notice tone="danger" role="alert">
                    {t('saveFailed')}
                </Notice>
            )}

            <button className="expense-form__submit" disabled={saving || partsProblem !== null} type="submit">
                {t('submit')}
            </button>
        </form>
    );
}

export { ExpenseForm };
