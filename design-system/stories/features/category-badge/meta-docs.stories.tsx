import { CategoryBadge } from '@/features/categories/category-badge';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@core/categories/category-style';
import { StoryRow } from '@stories/shared/layout';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/CategoryBadge',
    component: CategoryBadge,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <CategoryBadge style={{ color: 'vermillion', icon: 'restaurant' }} />;
};

export const Colors = () => {
    return (
        <StoryRow>
            {CATEGORY_COLORS.map((color) => (
                <CategoryBadge key={color} style={{ color, icon: 'restaurant' }} />
            ))}
        </StoryRow>
    );
};

export const Icons = () => {
    return (
        <StoryRow>
            {CATEGORY_ICONS.map((icon) => (
                <CategoryBadge key={icon} style={{ color: 'gray', icon }} />
            ))}
        </StoryRow>
    );
};

export default Story;
