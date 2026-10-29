import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { MonthSwitch } from '@/components/month-switch/month-switch';
import { Notice } from '@/components/notice/notice';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { incomeQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';
import { TOTAL_SCOPE, limitFor, percentOf } from '@core/budget';
import { fromDateString, toDateString } from '@core/date';
import { DEFAULT_CURRENCY, formatAmountInput, parseAmount } from '@core/money';
import { monthOf, shiftMonth } from '@core/month';

import { useBudgetActions } from './use-budget-actions';
import { useBudgets } from './use-budgets';

import './budgets.css';

function Budgets() {
    const t = useTranslations('budgets');
    const { locale } = useLocale();
    const online = useOnline();
    const { budgets, scopes, isError } = useBudgets();
    const { labelOf, styleOf } = useCategoryOptions();
    const income = useQuery(incomeQuery());
    const { save } = useBudgetActions();
    const [month, setMonth] = useState(() => monthOf(toDateString(new Date())));

    const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
    const monthOnly = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }), [locale]);
    const monthName = monthFormat.format(fromDateString(`${month}-01`));
    const incomeCents = income.data?.find((item) => item.month === month)?.amountCents ?? null;

    // What each scope holds in the month, from its own row or from an earlier month
    const held = new Map(scopes.map((scope) => [scope, limitFor(budgets, scope, month)]));
    const heldCents = (scope: string) => held.get(scope)?.cents ?? 0;
    const startText = (scope: string) => (heldCents(scope) === 0 ? '' : formatAmountInput(heldCents(scope), locale));

    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(scopes.map((scope) => [scope, startText(scope)]))
    );
    const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);

    // The fields start again from what the month holds whenever that changes: another month, a save, a new category
    const source = `${month}|${scopes.map((scope) => `${scope}:${heldCents(scope)}`).join(',')}`;
    const [shown, setShown] = useState(source);
    if (shown !== source) {
        setShown(source);
        setValues(Object.fromEntries(scopes.map((scope) => [scope, startText(scope)])));
        setInvalid(new Set());
        setFailed(false);
    }

    // What a field says in cents, 0 when it is empty, or null when it isn't an amount
    const centsOf = (scope: string) => {
        const text = (values[scope] ?? '').trim();
        return text === '' ? 0 : parseAmount(text, locale);
    };
    const changed = scopes.filter((scope) => {
        const cents = centsOf(scope);
        return cents === null || cents !== heldCents(scope);
    });

    function sinceName(since: string) {
        const day = fromDateString(`${since}-01`);
        return (since.slice(0, 4) === month.slice(0, 4) ? monthOnly : monthFormat).format(day);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = changed.map((scope) => ({ scope, amountCents: centsOf(scope) }));
        const refused = parsed.filter((item) => item.amountCents === null).map((item) => item.scope);
        if (refused.length > 0) {
            setInvalid(new Set(refused));
            return;
        }
        if (parsed.length === 0) return;

        setInvalid(new Set());
        setFailed(false);
        setBusy(true);
        try {
            await save(month, {
                currency: DEFAULT_CURRENCY,
                limits: parsed.map(({ scope, amountCents }) => ({ scope, amountCents: amountCents ?? 0 })),
            });
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="budgets">
            <h1 className="budgets__title">{t('title')}</h1>

            <MonthSwitch
                monthName={monthName}
                onPrevious={() => setMonth(shiftMonth(month, -1))}
                onNext={() => setMonth(shiftMonth(month, 1))}
            />

            <p className="budgets__hint">{t('hint')}</p>
            {isError && (
                <p className="budgets__hint" role="alert">
                    {t('loadFailed')}
                </p>
            )}
            {!online && <Notice role="status">{t('offline')}</Notice>}

            <form className="budgets__form" onSubmit={(event) => void handleSubmit(event)}>
                {scopes.map((scope) => {
                    const since = held.get(scope)?.since;
                    const cents = centsOf(scope);
                    const lines = [
                        since !== undefined && since !== month ? t('setIn', { month: sinceName(since) }) : null,
                        incomeCents !== null && cents !== null && cents > 0
                            ? t('ofIncome', { percent: percentOf(cents, incomeCents) })
                            : null,
                    ].filter((line) => line !== null);

                    return (
                        <Field
                            key={scope}
                            label={
                                scope === TOTAL_SCOPE ? (
                                    t('total')
                                ) : (
                                    <span className="budgets__label">
                                        <CategoryBadge style={styleOf(scope)} />
                                        {labelOf(scope)}
                                    </span>
                                )
                            }
                            hint={
                                lines.length > 0
                                    ? lines.map((line) => (
                                          <span key={line} className="budgets__hint-line">
                                              {line}
                                          </span>
                                      ))
                                    : undefined
                            }
                            error={invalid.has(scope) ? t('invalid') : null}
                        >
                            {(control) => (
                                <input
                                    {...control}
                                    autoComplete="off"
                                    disabled={!online || busy}
                                    inputMode="decimal"
                                    type="text"
                                    value={values[scope] ?? ''}
                                    onChange={(event) => {
                                        setValues({ ...values, [scope]: event.target.value });
                                        setInvalid(new Set([...invalid].filter((item) => item !== scope)));
                                    }}
                                />
                            )}
                        </Field>
                    );
                })}
                {failed && (
                    <Notice tone="danger" role="alert">
                        {t('saveFailed')}
                    </Notice>
                )}
                <Button disabled={!online || busy || changed.length === 0} type="submit" variant="primary">
                    {t('save')}
                </Button>
            </form>
        </section>
    );
}

export { Budgets };
