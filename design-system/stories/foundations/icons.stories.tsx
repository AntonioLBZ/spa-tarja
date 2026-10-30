import { Icon as IconComponent, type IconProps } from '@/components/icon/icon';
import { ICON_PATHS } from '@/components/icon/icon-paths';

import type { IconName } from '@/components/icon/icon-paths';
import type { Meta } from '@storybook/react-vite';

import './foundations.css';

const NAMES = Object.keys(ICON_PATHS) as IconName[];

const Story: Meta<IconProps> = {
    title: 'Foundations/Icons',
    component: IconComponent,
    args: { name: 'restaurant' },
    argTypes: { name: { control: 'select', options: NAMES } },
};

export const Single = (args: IconProps) => {
    return <IconComponent {...args} />;
};

export const Set = () => {
    return (
        <ul className="icon-grid">
            {NAMES.map((name) => (
                <li className="icon-grid__item" key={name}>
                    <span className="icon-grid__glyph">
                        <IconComponent name={name} />
                    </span>
                    <span className="icon-grid__name">{name}</span>
                </li>
            ))}
        </ul>
    );
};

export default Story;
