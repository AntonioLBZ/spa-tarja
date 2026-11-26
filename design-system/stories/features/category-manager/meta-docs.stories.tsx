import { CategoryManager } from '@/features/categories/category-manager';
import { withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/CategoryManager',
    component: CategoryManager,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: { docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 640 } } },
};

export const Basic = () => {
    return <CategoryManager />;
};

Basic.parameters = { appData: { categories: [...CUSTOM_CATEGORIES] } };

export const NoneOfTheirOwn = () => {
    return <CategoryManager />;
};

NoneOfTheirOwn.parameters = { appData: { categories: [] } };

export default Story;
