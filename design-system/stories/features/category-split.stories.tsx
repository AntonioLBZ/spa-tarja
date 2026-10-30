import { CategorySplit as CategorySplitComponent, type CategorySplitProps } from '@/features/charts/category-split';

import { useStoryCategories } from './fixtures';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<CategorySplitProps> = {
    title: 'Features/CategorySplit',
    component: CategorySplitComponent,
    args: {
        totals: [
            { categoryId: 'food', totalCents: 28000 },
            { categoryId: 'groceries', totalCents: 41550 },
            { categoryId: 'leisure', totalCents: 9000 },
            { categoryId: 'bills', totalCents: 52000 },
            { categoryId: 'custom-pets', totalCents: 9000 },
            { categoryId: 'other', totalCents: 1500 },
        ],
    },
    argTypes: { labelOf: { control: false }, styleOf: { control: false } },
};

export const CategorySplit = (args: CategorySplitProps) => {
    const { labelOf, styleOf } = useStoryCategories();

    return <CategorySplitComponent {...args} labelOf={labelOf} styleOf={styleOf} />;
};

export default Story;
