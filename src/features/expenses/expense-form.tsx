import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { useLocale } from '@/lib/i18n';
import { DEFAULT_CATEGORY_IDS, FALLBACK_CATEGORY_ID, type DefaultCategoryId } from '@core/categories';
import { suggestCategory } from '@core/classifier';
import { toDateString } from '@core/date';
import { TEXT_MAX_LENGTH } from '@core/expense';
import { DEFAULT_CURRENCY, parseAmount } from '@core/money';

import { useSaveExpense } from './use-save-expense';

import './expense-form.css';

function ExpenseForm() {
    const t = useTranslations('expenses.form');
    const tCategory = useTranslations('categories');
    const { locale } = useLocale();
    const save = useSaveExpense();
    const id = useId();

    const [amount, setAmount] = useState('');
    const [text, setText] = useState('');
    const [picked, setPicked] = useState<DefaultCategoryId | null>(null);
    const [date, setDate] = useState(() => toDateString(new Date()));
    const [amountInvalid, setAmountInvalid] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    // The category follows the description until the user picks one
    const suggestion = suggestCategory(text);
    const categoryId = picked ?? suggestion;
    const showSuggestion = picked === null && suggestion !== FALLBACK_CATEGORY_ID;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const amountCents = parseAmount(amount, locale);
        if (amountCents === null || amountCents < 1) {
            setAmountInvalid(true);
            return;
        }

        setAmountInvalid(false);
        setSaveFailed(false);
        setSaving(true);
        const now = Date.now();
        try {
            await save({
                id: crypto.randomUUID(),
                categoryId,
                text: text.trim(),
                amountCents,
                currency: DEFAULT_CURRENCY,
                date,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
            });
            setAmount('');
            setText('');
            setPicked(null);
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
                <select
                    id={`${id}-category`}
                    value={categoryId}
                    onChange={(event) => setPicked(event.target.value as DefaultCategoryId)}
                >
                    {DEFAULT_CATEGORY_IDS.map((option) => (
                        <option key={option} value={option}>
                            {tCategory(option)}
                        </option>
                    ))}
                </select>
                {showSuggestion && <p className="expense-form__hint">{t('suggested')}</p>}
            </div>

            <div className="expense-form__field">
                <label htmlFor={`${id}-date`}>{t('date')}</label>
                <input
                    id={`${id}-date`}
                    required
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                />
            </div>

            {amountInvalid && (
                <p className="expense-form__error" id={`${id}-error`} role="alert">
                    {t('amountInvalid')}
                </p>
            )}
            {saveFailed && !amountInvalid && (
                <p className="expense-form__error" role="alert">
                    {t('saveFailed')}
                </p>
            )}

            <button className="expense-form__submit" disabled={saving} type="submit">
                {t('submit')}
            </button>
        </form>
    );
}

export { ExpenseForm };
