import { Icon } from '@/components/icon/icon';
import { UI_ICONS, type IconName } from '@/components/icon/icon-paths';
import { CATEGORY_ICONS } from '@core/categories/category-style';

import type { Meta } from '@storybook/react-vite';

import './iconography.css';

interface IconGridProps {
    names: readonly IconName[];
}

const IconGrid = (props: IconGridProps) => {
    const { names } = props;

    return (
        <ul className="icon-grid">
            {names.map((name) => (
                <li className="icon-grid__item" key={name}>
                    <span className="icon-grid__glyph">
                        <Icon name={name} />
                    </span>
                    <span className="icon-grid__name">{name}</span>
                </li>
            ))}
        </ul>
    );
};

const Story: Meta = {
    title: 'Foundations/Iconography',
    tags: ['!dev'],
};

export const Interface = () => {
    return <IconGrid names={UI_ICONS} />;
};

export const Categories = () => {
    return <IconGrid names={CATEGORY_ICONS} />;
};

export default Story;
