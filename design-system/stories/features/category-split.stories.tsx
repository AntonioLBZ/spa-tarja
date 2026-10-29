import { CategorySplit } from '@/features/charts/category-split';

import { useStoryCategories } from './fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';

function CategorySplitDemo(props: { totals: { categoryId: string; totalCents: number }[] }) {
    const { totals } = props;
    const { labelOf, styleOf } = useStoryCategories();

    return <CategorySplit totals={totals} labelOf={labelOf} styleOf={styleOf} />;
}

const meta = {
    title: 'Features/CategorySplit',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Several: Story = {
    render: () => (
        <CategorySplitDemo
            totals={[
                { categoryId: 'food', totalCents: 28000 },
                { categoryId: 'groceries', totalCents: 41550 },
                { categoryId: 'leisure', totalCents: 9000 },
                { categoryId: 'bills', totalCents: 52000 },
                { categoryId: 'custom-pets', totalCents: 9000 },
                { categoryId: 'other', totalCents: 1500 },
            ]}
        />
    ),
};

const Single: Story = {
    render: () => <CategorySplitDemo totals={[{ categoryId: 'housing', totalCents: 75000 }]} />,
};

export default meta;
export { Several, Single };
