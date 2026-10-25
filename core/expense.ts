import * as v from 'valibot';

import { isCalendarDate } from './date';
import { MAX_AMOUNT_CENTS } from './money';

const TEXT_MAX_LENGTH = 200;

const timestamp = v.pipe(v.number(), v.integer(), v.minValue(0));

// How an expense was paid: at once, with a credit card or with a restaurant card (a restaurant card also counts as
// income of the month it is charged, see ARCHITECTURE.md §5)
const PAYMENTS = ['direct', 'credit', 'voucher'] as const;

const paymentSchema = v.picklist(PAYMENTS);

const calendarDate = v.pipe(v.string(), v.check(isCalendarDate, 'Not a calendar day'));

// Shape only: whether the category is valid is checked where the categories are known (`isCategoryId`). The payment and
// the charge date are optional because older clients don't write them: no payment is `direct`, no charge date is none.
const expenseInputSchema = v.pipe(
    v.object({
        categoryId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
        text: v.pipe(v.string(), v.maxLength(TEXT_MAX_LENGTH)),
        amountCents: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_AMOUNT_CENTS)),
        currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
        date: calendarDate,
        payment: v.optional(paymentSchema),
        chargeDate: v.optional(v.nullable(calendarDate)),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: v.nullable(timestamp),
    }),
    v.forward(
        v.check(
            ({ payment, chargeDate }) => (payment === 'credit' || payment === 'voucher' ? Boolean(chargeDate) : true),
            'A credit or restaurant card expense needs a charge date'
        ),
        ['chargeDate']
    ),
    v.forward(
        v.check(({ date, chargeDate }) => !chargeDate || chargeDate >= date, 'It cannot be charged before it is made'),
        ['chargeDate']
    )
);

const expenseIdSchema = v.pipe(v.string(), v.uuid());

type ExpenseInput = v.InferOutput<typeof expenseInputSchema>;

type Payment = (typeof PAYMENTS)[number];

type Expense = ExpenseInput & { id: string };

export { PAYMENTS, TEXT_MAX_LENGTH, expenseIdSchema, expenseInputSchema, paymentSchema };
export type { Expense, ExpenseInput, Payment };
