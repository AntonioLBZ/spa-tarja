import { CardList } from '@/components/card/card';
import { ExpenseRow } from '@/features/expenses/list/expense-row';
import { sampleExpense, withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';

import type { Meta } from '@storybook/react-vite';

import '@/features/expenses/list/expense-list.css';

const DAY = '2026-10-27';

const LUNCH = [sampleExpense('11111111-1111-4111-8111-111111111111', DAY)];

const Story: Meta = {
    title: 'Features/ExpenseRow',
    component: ExpenseRow,
    tags: ['!dev'],
    decorators: [
        (Story) => (
            <section className="expense-list__group">
                <CardList flush>
                    <Story />
                </CardList>
            </section>
        ),
        withAppData,
    ],
    parameters: {
        docs: { source: { type: 'code' }, story: { inline: false, iframeHeight: 120 } },
        appData: { categories: [...CUSTOM_CATEGORIES] },
    },
};

export const Basic = () => {
    return (
        <ExpenseRow
            expenses={LUNCH}
            isPlan={false}
            pending={false}
            leaving={false}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export const NoText = () => {
    return (
        <ExpenseRow
            expenses={[sampleExpense('11111111-1111-4111-8111-111111111112', DAY, { text: '' })]}
            isPlan={false}
            pending={false}
            leaving={false}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export const Credit = () => {
    return (
        <ExpenseRow
            expenses={[
                sampleExpense('11111111-1111-4111-8111-111111111117', DAY, {
                    categoryId: 'leisure',
                    text: 'Concert tickets',
                    amountCents: 6400,
                    payment: 'credit',
                    chargeDate: '2026-11-05',
                }),
            ]}
            isPlan={false}
            pending={false}
            leaving={false}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export const RestaurantCard = () => {
    return (
        <ExpenseRow
            expenses={[
                sampleExpense('11111111-1111-4111-8111-111111111118', DAY, {
                    text: 'Team lunch',
                    amountCents: 9600,
                    payment: 'voucher',
                    chargeDate: '2026-11-01',
                    personalCents: 2400,
                }),
            ]}
            isPlan={false}
            pending={false}
            leaving={false}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export const Installments = () => {
    const plan = [1, 2, 3].map((part) =>
        sampleExpense(`11111111-1111-4111-8111-11111111112${part}`, DAY, {
            categoryId: 'housing',
            text: 'Sofa',
            amountCents: 30000,
            payment: 'credit',
            chargeDate: `2026-1${part - 1}-05`,
            plan: { id: '2a8f6a52-6d4a-4f0e-9d7b-3b8f5f5e3c11', part, parts: 3 },
        })
    );

    return (
        <ExpenseRow
            expenses={plan}
            isPlan
            pending={false}
            leaving={false}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export const ShowDate = () => {
    return (
        <ExpenseRow
            expenses={LUNCH}
            isPlan={false}
            pending={false}
            leaving={false}
            showDate
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export const Pending = () => {
    return (
        <ExpenseRow
            expenses={LUNCH}
            isPlan={false}
            pending
            leaving={false}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
        />
    );
};

export default Story;
