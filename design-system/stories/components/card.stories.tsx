import { Card, CardList } from '@/components/card/card';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Components/Card',
    component: Card,
    args: { children: 'A box with the notch' },
} satisfies Meta<typeof Card>;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

const List: Story = {
    render: () => (
        <CardList label="Groceries">
            {['Supermarket', 'Bakery', 'Market'].map((name) => (
                <Card as="li" key={name}>
                    {name}
                </Card>
            ))}
        </CardList>
    ),
};

const Flush: Story = {
    render: () => (
        <CardList flush label="Groceries">
            {['Supermarket', 'Bakery', 'Market'].map((name) => (
                <Card as="li" key={name}>
                    {name}
                </Card>
            ))}
        </CardList>
    ),
};

const Definitions: Story = {
    render: () => (
        <CardList as="dl">
            <Card>
                <dt>Income</dt>
                <dd>1.500,00 €</dd>
            </Card>
            <Card>
                <dt>Spent</dt>
                <dd>842,10 €</dd>
            </Card>
        </CardList>
    ),
};

export default meta;
export { Default, Definitions, Flush, List };
