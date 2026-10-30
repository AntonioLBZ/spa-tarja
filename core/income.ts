import * as v from 'valibot';

import { MAX_AMOUNT_CENTS } from './money';
import { isMonth } from './month';

const monthSchema = v.pipe(v.string(), v.check(isMonth, 'Not a month'));

const incomeInputSchema = v.object({
    amountCents: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_AMOUNT_CENTS)),
    currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
});

type IncomeInput = v.InferOutput<typeof incomeInputSchema>;

// What a person earns in a month; there is one for each month they set
interface Income extends IncomeInput {
    month: string;
}

export { incomeInputSchema, monthSchema, type Income, type IncomeInput };
