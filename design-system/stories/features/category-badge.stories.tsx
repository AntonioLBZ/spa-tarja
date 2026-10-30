import { CategoryBadge as CategoryBadgeComponent } from '@/features/categories/category-badge';
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryStyle } from '@core/category-style';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<CategoryStyle> = {
    title: 'Features/CategoryBadge',
    args: { color: 'vermillion', icon: 'restaurant' },
    argTypes: {
        color: { control: 'select', options: CATEGORY_COLORS },
        icon: { control: 'select', options: CATEGORY_ICONS },
    },
};

export const CategoryBadge = (args: CategoryStyle) => {
    return <CategoryBadgeComponent style={args} />;
};

export default Story;
