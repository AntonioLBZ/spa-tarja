import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { DEFAULT_CURRENCY, formatAmountInput, parseAmount } from '@core/money';

import { useIncomeActions } from './use-income-actions';

import type { Income } from '@core/income';

import './income-form.css';

type Failure = 'saveFailed' | 'removeFailed';

function IncomeForm(props: { month: string; monthName: string; income: Income | undefined }) {
    const { month, monthName, income } = props;
    const t = useTranslations('summary.form');
    const { locale } = useLocale();
    const online = useOnline();
    const { save, remove } = useIncomeActions();
    const id = useId();

    const stored = income?.amountCents ?? null;
    const [value, setValue] = useState(() => (stored === null ? '' : formatAmountInput(stored, locale)));
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [busy, setBusy] = useState(false);

    // The field starts again from what the month has whenever that changes: another month, a save, a removal
    const source = `${month}:${stored}`;
    const [shown, setShown] = useState(source);
    if (shown !== source) {
        setShown(source);
        setValue(stored === null ? '' : formatAmountInput(stored, locale));
        setInvalid(false);
        setFailure(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const amountCents = parseAmount(value, locale);
        if (amountCents === null || amountCents < 1) {
            setInvalid(true);
            return;
        }

        setInvalid(false);
        setFailure(null);
        setBusy(true);
        try {
            await save(month, { amountCents, currency: DEFAULT_CURRENCY });
        } catch {
            setFailure('saveFailed');
        } finally {
            setBusy(false);
        }
    }

    async function handleRemove() {
        setFailure(null);
        setBusy(true);
        try {
            await remove(month);
        } catch {
            setFailure('removeFailed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="income-form" onSubmit={(event) => void handleSubmit(event)}>
            <label htmlFor={`${id}-amount`}>{t('label', { month: monthName })}</label>
            <div className="income-form__row">
                <input
                    className="income-form__input"
                    id={`${id}-amount`}
                    aria-describedby={invalid ? `${id}-error` : undefined}
                    aria-invalid={invalid}
                    autoComplete="off"
                    inputMode="decimal"
                    type="text"
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setInvalid(false);
                    }}
                />
                <button disabled={!online || busy} type="submit">
                    {t('save')}
                </button>
                {stored !== null && (
                    <button disabled={!online || busy} type="button" onClick={() => void handleRemove()}>
                        {t('remove')}
                    </button>
                )}
            </div>
            {invalid && (
                <p className="income-form__error" id={`${id}-error`} role="alert">
                    {t('invalid')}
                </p>
            )}
            {failure && (
                <p className="income-form__error" role="alert">
                    {t(failure)}
                </p>
            )}
        </form>
    );
}

export { IncomeForm };
