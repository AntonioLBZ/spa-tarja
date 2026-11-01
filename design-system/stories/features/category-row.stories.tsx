import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';
import { CategoryRow as CategoryRowComponent, type CategoryRowProps } from '@/features/categories/category-row';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

const pause = () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 400));

const Story: Meta<CategoryRowProps> = {
    title: 'Features/CategoryRow',
    args: {
        category: { id: 'custom-pets', name: 'Pets', color: 'orange', icon: 'pets' },
        disabled: false,
        fallbackLabel: 'Other',
        onEdit: fn(),
        onDelete: fn(pause),
    },
    argTypes: {
        fallbackLabel: { control: 'text' },
        onEdit: { control: false },
        onDelete: { control: false },
        toggleRef: { control: false },
    },
};

// A row on its sheet, as the categories screen has it
export const CategoryRow = (args: CategoryRowProps) => {
    return (
        <Sheet label="Yours">
            <CardList flush>
                <CategoryRowComponent {...args} />
            </CardList>
        </Sheet>
    );
};

export default Story;
