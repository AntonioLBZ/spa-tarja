import { CategorySplit } from '@/features/charts/category-split';
import { useStoryCategories } from '@stories/shared/fixtures';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/CategorySplit',
    component: CategorySplit,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'code' } } },
};

const TOTALS = [
    { categoryId: 'food', totalCents: 28000 },
    { categoryId: 'groceries', totalCents: 41550 },
    { categoryId: 'leisure', totalCents: 9000 },
    { categoryId: 'bills', totalCents: 52000 },
    { categoryId: 'custom-pets', totalCents: 9000 },
    { categoryId: 'other', totalCents: 1500 },
];

export const Basic = () => {
    const { labelOf, styleOf } = useStoryCategories();
    const [picked, setPicked] = useState<string | null>(null);

    return (
        <CategorySplit
            totals={TOTALS}
            labelOf={labelOf}
            styleOf={styleOf}
            picked={picked}
            onPick={setPicked}
            onEmptied={() => undefined}
        />
    );
};

export const Picked = () => {
    const { labelOf, styleOf } = useStoryCategories();
    const [picked, setPicked] = useState<string | null>('groceries');

    return (
        <CategorySplit
            totals={TOTALS}
            labelOf={labelOf}
            styleOf={styleOf}
            picked={picked}
            onPick={setPicked}
            onEmptied={() => undefined}
        />
    );
};

export const PickedAtZero = () => {
    const { labelOf, styleOf } = useStoryCategories();

    return (
        <CategorySplit
            totals={[...TOTALS, { categoryId: 'transport', totalCents: 0 }]}
            labelOf={labelOf}
            styleOf={styleOf}
            picked="transport"
            onPick={() => undefined}
            onEmptied={() => undefined}
        />
    );
};

export default Story;
