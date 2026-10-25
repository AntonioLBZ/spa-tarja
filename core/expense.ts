import * as v from 'valibot';

import { isCalendarDate } from './date';
import { MAX_AMOUNT_CENTS } from './money';

const TEXT_MAX_LENGTH = 200;

const timestamp = v.pipe(v.number(), v.integer(), v.minValue(0));

// Shape only: whether the category exists is checked where the categories are known
const expenseInputSchema = v.object({
    categoryId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
    text: v.pipe(v.string(), v.maxLength(TEXT_MAX_LENGTH)),
    amountCents: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_AMOUNT_CENTS)),
    currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
    date: v.pipe(v.string(), v.check(isCalendarDate, 'Not a calendar day')),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: v.nullable(timestamp),
});

const expenseIdSchema = v.pipe(v.string(), v.uuid());

type ExpenseInput = v.InferOutput<typeof expenseInputSchema>;

type Expense = ExpenseInput & { id: string };

export { TEXT_MAX_LENGTH, expenseIdSchema, expenseInputSchema };
export type { Expense, ExpenseInput };
