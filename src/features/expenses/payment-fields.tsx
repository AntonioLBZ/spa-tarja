import { useState, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Field } from '@/components/field/field';
import { Select } from '@/components/select/select';
import { addMonths } from '@core/date';
import { PAYMENTS, type Payment } from '@core/expense';

interface PaymentStart {
    payment: Payment;
    chargeDate: string | null;
}

interface PaymentFieldsProps {
    label: string;
    hint?: ReactNode;
    error?: ReactNode;
    state: PaymentState;
    // After the payment changes, for what goes with it
    onChoose?: (payment: Payment) => void;
}

type PaymentState = ReturnType<typeof usePayment>;

// How an expense is paid and the day a card charges it, which both tails of the form show
const usePayment = (start: PaymentStart, date: string) => {
    const [payment, setPayment] = useState(start.payment);
    const [pickedCharge, setPickedCharge] = useState(start.chargeDate);
    const [chargeInvalid, setChargeInvalid] = useState(false);
    // A deferred expense is charged a month after it was made unless the person picks the day
    const chargeDate = payment === 'direct' ? null : (pickedCharge ?? addMonths(date, 1));

    return {
        payment,
        chargeDate,
        chargeInvalid,
        choose: (next: Payment) => {
            setPayment(next);
            setChargeInvalid(false);
        },
        pickCharge: (day: string) => {
            setPickedCharge(day);
            setChargeInvalid(false);
        },
        setChargeInvalid,
        // Back to paying now
        reset: () => {
            setPayment('direct');
            setPickedCharge(null);
            setChargeInvalid(false);
        },
    };
};

const PaymentFields = (props: PaymentFieldsProps) => {
    const { label, hint, error, state, onChoose } = props;
    const t = useTranslations('expenses.form');
    const tPayment = useTranslations('expenses.payment');
    const { chargeDate } = state;

    return (
        <>
            <Field label={label} hint={hint} error={error}>
                {(control) => (
                    <Select
                        {...control}
                        options={PAYMENTS.map((kind) => ({ value: kind, label: tPayment(kind) }))}
                        value={state.payment}
                        onChange={(next) => {
                            state.choose(next);
                            onChoose?.(next);
                        }}
                    />
                )}
            </Field>

            {chargeDate !== null && (
                <Field label={t('chargeDate')} error={state.chargeInvalid ? t('chargeDateInvalid') : null}>
                    {(control) => (
                        <input
                            {...control}
                            required
                            type="date"
                            value={chargeDate}
                            onChange={(event) => state.pickCharge(event.target.value)}
                        />
                    )}
                </Field>
            )}
        </>
    );
};

export { PaymentFields, usePayment, type PaymentFieldsProps, type PaymentState };
