import clsx from 'clsx';

import { Icon } from '@/components/icon/icon';

import type { CategoryStyle } from '@core/category-style';

import './category-badge.css';

// The icon of a category in its color. The name always goes next to it: the color alone says nothing.
function CategoryBadge(props: { style: CategoryStyle }) {
    const { style } = props;

    return (
        <span className={clsx('category-badge', `category-badge--${style.color}`)}>
            <Icon name={style.icon} />
        </span>
    );
}

export { CategoryBadge };
