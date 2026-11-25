import { CategorySplit as CategorySplitComponent, type CategorySplitProps } from '@/features/charts/category-split';
import { useState } from 'react';

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
        picked: null,
    },
    argTypes: { labelOf: { control: false }, styleOf: { control: false }, onPick: { control: false } },
};

export const CategorySplit = (args: CategorySplitProps) => {
    const { labelOf, styleOf } = useStoryCategories();
    const [picked, setPicked] = useState(args.picked);

    return <CategorySplitComponent {...args} labelOf={labelOf} styleOf={styleOf} picked={picked} onPick={setPicked} />;
};

export default Story;
