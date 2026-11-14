import { useId, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Select } from '@/components/select/select';
import { useLocale } from '@/lib/i18n';
import { installmentDates, planBalance, splitEvenly } from '@core/installments';
import { DEFAULT_CURRENCY, formatAmount, formatAmountInput, parseAmount } from '@core/money';

import { PaymentFields, type PaymentState } from './payment-fields';
import { useShortDate } from './use-short-date';

import type { Payment } from '@core/expense';

// A year of monthly payments; the data allows longer plans (core/installments)
const INSTALLMENT_CHOICES = Array.from({ length: 12 }, (_, index) => index + 1);

// What the person typed in the parts, valid only for the total and the count it was typed for
interface TypedParts {
    key: string;
    values: string[];
}

interface PersonalStart {
    personal: string;
    installments: number;
    parts: TypedParts | null;
}

interface PersonalTailProps {
    tail: PersonalTailState;
    payment: PaymentState;
    // Add was pressed: what is left of the plan is said as an error
    tried?: boolean;
}

type PersonalTailState = ReturnType<typeof usePersonalTail>;

// The tail of an expense of one person: your part of a restaurant card, and the installments of what is paid now
const usePersonalTail = (start: PersonalStart, totalCents: number | null, date: string, payment: Payment) => {
    const { locale } = useLocale();
    const [personal, setPersonal] = useState(start.personal);
    const [installments, setInstallments] = useState(start.installments);
    const [editedParts, setEditedParts] = useState<TypedParts | null>(start.parts);
    const [personalInvalid, setPersonalInvalid] = useState(false);

    // The number of payments of a plan edited here, when it is longer than the form offers
    const installmentChoices = INSTALLMENT_CHOICES.includes(start.installments)
        ? INSTALLMENT_CHOICES
        : [...INSTALLMENT_CHOICES, start.installments];
    // Only what is paid at once can be split: a deferred expense is already charged on a day of its own
    const parts = payment === 'direct' ? installments : 1;
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

    const personalBad = personalText !== '' && personalCents === null;

    return {
        personal,
        personalCents,
        personalInvalid,
        personalOver,
        paidBack,
        installments,
        installmentChoices,
        parts,
        planDates,
        partTexts,
        partCents,
        balance,
        partsProblem,
        // Something to fix in what the form folds under More options
        optionsProblem: partsProblem !== null || personalOver || personalBad,
        typePersonal: (value: string) => {
            setPersonal(value);
            setPersonalInvalid(false);
        },
        clearPersonal: () => {
            setPersonal('');
            setPersonalInvalid(false);
        },
        pickInstallments: setInstallments,
        editPart: (index: number, value: string) => {
            setEditedParts({ key: partsKey, values: partTexts.map((text, at) => (at === index ? value : text)) });
        },
        // Whether it can be saved; a part of yours that isn't an amount is marked
        check: (): boolean => {
            if (partsProblem !== null) return false;
            if (personalBad) {
                setPersonalInvalid(true);
                return false;
            }
            setPersonalInvalid(false);
            return !personalOver;
        },
        // The amount of each payment, for a total that is an amount
        amounts: (amountCents: number): number[] => {
            return parts === 1 ? [amountCents] : partCents.filter((cents) => cents !== null);
        },
        reset: () => {
            setPersonal('');
            setInstallments(1);
            setEditedParts(null);
        },
    };
};

const PersonalTail = (props: PersonalTailProps) => {
    const { tail, payment, tried = false } = props;
    const t = useTranslations('expenses.form');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const id = useId();
    const { parts, partsProblem, balance } = tail;
    // Once Add was pressed, parts that don't add up are each marked, as what is left is an error then
    const sumBad = tried && (partsProblem === 'over' || partsProblem === 'remaining');

    return (
        <>
            <PaymentFields
                label={t('payment')}
                state={payment}
                onChoose={(next) => {
                    if (next !== 'voucher') tail.clearPersonal();
                }}
            />

            {payment.payment === 'voucher' && (
                <Field
                    label={t('personal')}
                    hint={
                        tail.paidBack > 0
                            ? t('paidBack', { amount: formatAmount(tail.paidBack, DEFAULT_CURRENCY, locale) })
                            : undefined
                    }
                    error={tail.personalOver ? t('personalOver') : tail.personalInvalid ? t('personalInvalid') : null}
                >
                    {(control) => (
                        <input
                            {...control}
                            autoComplete="off"
                            inputMode="decimal"
                            type="text"
                            value={tail.personal}
                            onChange={(event) => tail.typePersonal(event.target.value)}
                        />
                    )}
                </Field>
            )}

            {payment.payment === 'direct' && (
                <Field label={t('installments')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={tail.installmentChoices.map((count) => ({
                                value: String(count),
                                label: t('installmentsOption', { count }),
                            }))}
                            value={String(tail.installments)}
                            onChange={(next) => tail.pickInstallments(Number(next))}
                        />
                    )}
                </Field>
            )}

            {parts > 1 &&
                tail.partTexts.map((value, index) => (
                    <Field
                        key={tail.planDates[index]}
                        label={t('part', { part: index + 1, parts, date: shortDate(tail.planDates[index]!) })}
                        describedBy={partsProblem === 'invalid' || sumBad ? `${id}-parts-error` : undefined}
                    >
                        {(control) => (
                            <input
                                {...control}
                                // The one message under the parts speaks for all of them
                                aria-invalid={sumBad || tail.partCents[index] === null || tail.partCents[index]! < 1}
                                autoComplete="off"
                                inputMode="decimal"
                                required
                                type="text"
                                value={value}
                                onChange={(event) => tail.editPart(index, event.target.value)}
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
                <Notice tone="danger" role="alert" id={sumBad ? `${id}-parts-error` : undefined}>
                    {t('over', { amount: formatAmount(-balance, DEFAULT_CURRENCY, locale) })}
                </Notice>
            )}
            {partsProblem === 'remaining' && tried && (
                <Notice tone="danger" role="alert" id={`${id}-parts-error`}>
                    {t('remaining', { amount: formatAmount(balance, DEFAULT_CURRENCY, locale) })}
                </Notice>
            )}
            {partsProblem === 'remaining' && !tried && (
                <p className="field__hint" role="status">
                    {t('remaining', { amount: formatAmount(balance, DEFAULT_CURRENCY, locale) })}
                </p>
            )}
        </>
    );
};

export { PersonalTail, usePersonalTail, type PersonalStart, type PersonalTailProps, type TypedParts };
