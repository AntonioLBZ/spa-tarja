import * as v from 'valibot';

import { isCalendarDate } from './date';
import { MAX_INSTALLMENTS } from './installments';
import { MAX_AMOUNT_CENTS } from './money';

const TEXT_MAX_LENGTH = 200;

const timestamp = v.pipe(v.number(), v.integer(), v.minValue(0));

// How an expense was paid: at once, with a credit card or with a restaurant card (what a restaurant card pays for you
// also counts as income of the month it is charged, see ARCHITECTURE.md §5)
const PAYMENTS = ['direct', 'credit', 'voucher'] as const;

const paymentSchema = v.picklist(PAYMENTS);

// One part of an expense paid in installments: the plan it belongs to, which part it is and how many there are
const planSchema = v.pipe(
    v.object({
        id: v.pipe(v.string(), v.uuid()),
        part: v.pipe(v.number(), v.integer(), v.minValue(1)),
        parts: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(MAX_INSTALLMENTS)),
    }),
    v.check(({ part, parts }) => part <= parts, 'There is no such part')
);

const calendarDate = v.pipe(v.string(), v.check(isCalendarDate, 'Not a calendar day'));

// Shape only: whether the category is valid is checked where the categories are known (`isCategoryId`). The payment, the
// charge date and your part are optional because older clients don't write them: no payment is `direct`, no charge date
// is none and no part is the whole amount. `personalCents` is your part of what a restaurant card paid, when others pay
// you back the rest.
const expenseInputSchema = v.pipe(
    v.object({
        categoryId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
        text: v.pipe(v.string(), v.maxLength(TEXT_MAX_LENGTH)),
        amountCents: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_AMOUNT_CENTS)),
        currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
        date: calendarDate,
        payment: v.optional(paymentSchema),
        chargeDate: v.optional(v.nullable(calendarDate)),
        personalCents: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
        plan: v.optional(v.nullable(planSchema)),
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
        v.check(({ payment, plan }) => !plan || payment !== 'voucher', 'A restaurant card is not paid in installments'),
        ['plan']
    ),
    v.forward(
        v.check(({ date, chargeDate }) => !chargeDate || chargeDate >= date, 'It cannot be charged before it is made'),
        ['chargeDate']
    ),
    v.forward(
        v.check(
            ({ payment, personalCents }) => typeof personalCents !== 'number' || payment === 'voucher',
            'Only a restaurant card expense has a part of your own'
        ),
        ['personalCents']
    ),
    v.forward(
        v.check(
            ({ amountCents, personalCents }) => typeof personalCents !== 'number' || personalCents <= amountCents,
            'Your part cannot be more than what was paid'
        ),
        ['personalCents']
    )
);

const expenseIdSchema = v.pipe(v.string(), v.uuid());

type ExpenseInput = v.InferOutput<typeof expenseInputSchema>;

type Payment = (typeof PAYMENTS)[number];

type Expense = ExpenseInput & { id: string };

export { PAYMENTS, TEXT_MAX_LENGTH, expenseIdSchema, expenseInputSchema, paymentSchema };
export type { Expense, ExpenseInput, Payment };
