import clsx from 'clsx';

import { Icon } from '@/components/icon/icon';

import type { CategoryStyle } from '@core/category-style';

import './category-badge.css';

interface CategoryBadgeProps {
    style: CategoryStyle;
    // A rounded square tinted with the color, which holds the icon: for a row, where the category is the first thing seen
    sticker?: boolean;
}

// The icon of a category in its color. The name always goes next to it: the color alone says nothing.
const CategoryBadge = (props: CategoryBadgeProps) => {
    const { style, sticker } = props;
    const badgeClsx = clsx('category-badge', `category-badge--${style.color}`, { 'category-badge--sticker': sticker });

    return (
        <span className={badgeClsx}>
            <Icon name={style.icon} />
        </span>
    );
};

export { CategoryBadge, type CategoryBadgeProps };
