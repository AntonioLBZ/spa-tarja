import { Card, CardList } from '@/components/card/card';
import { CategoryRow as CategoryRowComponent, type CategoryRowProps } from '@/features/categories/category-row';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

const pause = () => new Promise<null>((resolve) => setTimeout(() => resolve(null), 400));

interface CategoryRowStoryProps extends Omit<CategoryRowProps, 'isTaken'> {
    // The name another category already has, which the row refuses
    taken: string;
}

const Story: Meta<CategoryRowStoryProps> = {
    title: 'Features/CategoryRow',
    args: {
        category: { id: 'custom-pets', name: 'Pets', color: 'orange', icon: 'pets' },
        disabled: false,
        fallbackLabel: 'Other',
        taken: 'Cats',
        onSave: fn(pause),
        onDelete: fn(() => pause().then(() => true)),
    },
    argTypes: {
        fallbackLabel: { control: 'text' },
        onSave: { control: false },
        onDelete: { control: false },
    },
};

export const CategoryRow = (args: CategoryRowStoryProps) => {
    const { taken, ...props } = args;

    return (
        <CardList>
            <CategoryRowComponent {...props} isTaken={(name) => name === taken} />
            <Card as="li">A row that is not a category, for comparison</Card>
        </CardList>
    );
};

export default Story;
