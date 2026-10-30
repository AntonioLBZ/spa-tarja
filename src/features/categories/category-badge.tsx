import clsx from 'clsx';

import { Icon } from '@/components/icon/icon';

import type { CategoryStyle } from '@core/category-style';

import './category-badge.css';

interface CategoryBadgeProps {
    style: CategoryStyle;
}

// The icon of a category in its color. The name always goes next to it: the color alone says nothing.
const CategoryBadge = (props: CategoryBadgeProps) => {
    const { style } = props;
    const badgeClsx = clsx('category-badge', `category-badge--${style.color}`);

    return (
        <span className={badgeClsx}>
            <Icon name={style.icon} />
        </span>
    );
};

export { CategoryBadge, type CategoryBadgeProps };
