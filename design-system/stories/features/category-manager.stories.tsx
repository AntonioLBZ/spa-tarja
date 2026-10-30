import { CategoryManager as CategoryManagerComponent } from '@/features/categories/category-manager';

import { AppData } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Meta } from '@storybook/react-vite';

interface CategoryManagerStoryProps {
    // Whether the person has categories of their own besides the built-in ones
    ownCategories: boolean;
}

const Story: Meta<CategoryManagerStoryProps> = {
    title: 'Features/CategoryManager',
    args: { ownCategories: true },
};

export const CategoryManager = (args: CategoryManagerStoryProps) => {
    const { ownCategories } = args;
    const categories = ownCategories ? [...CUSTOM_CATEGORIES] : [];

    return (
        <AppData key={String(ownCategories)} api={{ categories }}>
            {() => <CategoryManagerComponent />}
        </AppData>
    );
};

export default Story;
