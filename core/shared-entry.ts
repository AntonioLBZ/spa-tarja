import * as v from 'valibot';

import { isCalendarDate } from './date';
import { TEXT_MAX_LENGTH, paymentSchema } from './expense';
import { MAX_AMOUNT_CENTS } from './money';
import { memberIdSchema } from './shared-group';

// How an expense was split; only the shares are stored, the mode only reopens the form as it was left
const SPLIT_MODES = ['equal', 'percent', 'exact'] as const;

// Stored exactly: a larger integer would be kept as a real
const timestamp = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

const calendarDate = v.pipe(v.string(), v.check(isCalendarDate, 'Not a calendar day'));

// In lower case, so that two spellings of one id are the same entry
const entryIdSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase());

// What a member owes of an entry; a member who is out of it has no share at all
const shareSchema = v.object({
    memberId: memberIdSchema,
    cents: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

const entryFields = {
    text: v.pipe(v.string(), v.maxLength(TEXT_MAX_LENGTH)),
    amountCents: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_AMOUNT_CENTS)),
    currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
    date: calendarDate,
    paidBy: memberIdSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: v.nullable(timestamp),
};

// The category's shape only: whether it is a default one is checked apart (`isDefaultCategoryId`), so that it can be
// told from a bad shape. `payment` and `chargeDate` say how the payer paid; left out, it was paid now.
const sharedExpenseSchema = v.object({
    ...entryFields,
    kind: v.literal('expense'),
    categoryId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
    split: v.picklist(SPLIT_MODES),
    shares: v.pipe(v.array(shareSchema), v.minLength(1)),
    payment: v.optional(paymentSchema, 'direct'),
    chargeDate: v.optional(v.nullable(calendarDate), null),
});

// `paidBy` paid the member of the one share
const settlementSchema = v.object({
    ...entryFields,
    kind: v.literal('settlement'),
    categoryId: v.optional(v.null(), null),
    split: v.optional(v.literal('exact'), 'exact'),
    shares: v.pipe(v.array(shareSchema), v.length(1)),
    payment: v.optional(v.literal('direct'), 'direct'),
    chargeDate: v.optional(v.null(), null),
});

// An entry of a group as the client writes it. Whether its members are in the group, and the group's currency, are
// checked where the group is known.
const sharedEntryInputSchema = v.pipe(
    v.variant('kind', [sharedExpenseSchema, settlementSchema]),
    v.forward(
        v.check(
            ({ shares }) => new Set(shares.map((share) => share.memberId)).size === shares.length,
            'A member has two shares'
        ),
        ['shares']
    ),
    v.forward(
        v.check(
            ({ amountCents, shares }) => shares.reduce((sum, share) => sum + share.cents, 0) === amountCents,
            'The shares do not add up to the amount'
        ),
        ['shares']
    ),
    v.forward(
        v.check(
            ({ kind, paidBy, shares }) => kind === 'expense' || shares.every((share) => share.memberId !== paidBy),
            'Nobody pays themselves'
        ),
        ['shares']
    ),
    v.forward(
        v.check(
            ({ payment, chargeDate }) => (payment === 'direct') === (chargeDate === null),
            'A card has a charge date, and paying now has none'
        ),
        ['chargeDate']
    ),
    v.forward(
        v.check(({ date, chargeDate }) => !chargeDate || chargeDate >= date, 'It cannot be charged before it is made'),
        ['chargeDate']
    ),
    v.forward(
        v.check(
            ({ payment, paidBy, shares }) => payment === 'direct' || shares.some((share) => share.memberId === paidBy),
            'Whoever paid by card has a share'
        ),
        ['shares']
    )
);

type Share = v.InferOutput<typeof shareSchema>;

type SplitMode = (typeof SPLIT_MODES)[number];

type SharedEntryInput = v.InferOutput<typeof sharedEntryInputSchema>;

type SharedEntry = SharedEntryInput & { id: string };

// An entry as a group keeps it: who made it and who wrote it last, as their members in the group, none once that person
// deleted their account
type LedgerEntry = SharedEntry & { createdBy: string | null; updatedBy: string | null };

export {
    SPLIT_MODES,
    entryIdSchema,
    sharedEntryInputSchema,
    type LedgerEntry,
    type Share,
    type SharedEntry,
    type SharedEntryInput,
    type SplitMode,
};
