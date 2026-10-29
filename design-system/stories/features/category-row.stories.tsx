import { Card, CardList } from '@/components/card/card';
import { CategoryRow } from '@/features/categories/category-row';

import { CUSTOM_CATEGORIES } from './fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';

const pause = () => new Promise<null>((resolve) => setTimeout(() => resolve(null), 400));

function CategoryRowDemo(props: { disabled?: boolean; taken?: string }) {
    const { disabled = false, taken } = props;

    return (
        <CardList>
            {CUSTOM_CATEGORIES.map((category) => (
                <CategoryRow
                    key={category.id}
                    category={category}
                    disabled={disabled}
                    fallbackLabel="Other"
                    isTaken={(name) => name === taken}
                    onDelete={() => pause().then(() => true)}
                    onSave={() => pause()}
                />
            ))}
            <Card as="li">A row that is not a category, for comparison</Card>
        </CardList>
    );
}

const meta = {
    title: 'Features/CategoryRow',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = { render: () => <CategoryRowDemo /> };

const Offline: Story = { render: () => <CategoryRowDemo disabled /> };

const NameTaken: Story = { render: () => <CategoryRowDemo taken="Cats" /> };

export default meta;
export { Default, NameTaken, Offline };
