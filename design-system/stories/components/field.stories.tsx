import { Field } from '@/components/field/field';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Components/Field',
    component: Field,
    args: {
        label: 'Amount',
        children: (control) => <input type="text" inputMode="decimal" {...control} />,
    },
} satisfies Meta<typeof Field>;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

const WithHint: Story = { args: { hint: 'Use a dot or a comma for the cents.' } };

const WithError: Story = { args: { error: 'The amount is not a number.' } };

const Valid: Story = { args: { error: null } };

const Select: Story = {
    args: {
        label: 'Payment',
        children: (control) => (
            <select {...control}>
                <option>Cash</option>
                <option>Card</option>
            </select>
        ),
    },
};

export default meta;
export { Default, Select, Valid, WithError, WithHint };
