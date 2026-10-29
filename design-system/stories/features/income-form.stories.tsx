import { IncomeForm } from '@/features/summary/income-form';

import { AppData } from './app-data';

import type { Meta, StoryObj } from '@storybook/react-vite';

const MONTH = '2026-10';

function Form(props: { amountCents?: number }) {
    const { amountCents } = props;
    const income = amountCents === undefined ? [] : [{ month: MONTH, amountCents, currency: 'EUR' }];

    return (
        <AppData api={{ income }}>
            {() => <IncomeForm month={MONTH} monthName="October 2026" income={income[0]} />}
        </AppData>
    );
}

const meta = {
    title: 'Features/IncomeForm',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const NotSet: Story = { render: () => <Form /> };

const AlreadySet: Story = { render: () => <Form amountCents={150000} /> };

export default meta;
export { AlreadySet, NotSet };
