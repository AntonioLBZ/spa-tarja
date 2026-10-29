import { Icon } from '@/components/icon/icon';
import { ICON_PATHS } from '@/components/icon/icon-paths';

import type { IconName } from '@/components/icon/icon-paths';
import type { Meta, StoryObj } from '@storybook/react-vite';

import './foundations.css';

const NAMES = Object.keys(ICON_PATHS) as IconName[];

const meta = {
    title: 'Foundations/Icons',
    component: Icon,
    args: { name: 'restaurant' },
    argTypes: { name: { control: 'select', options: NAMES } },
} satisfies Meta<typeof Icon>;

type Story = StoryObj<typeof meta>;

const Single: Story = {};

const Set: Story = {
    render: () => (
        <ul className="icon-grid">
            {NAMES.map((name) => (
                <li className="icon-grid__item" key={name}>
                    <span className="icon-grid__glyph">
                        <Icon name={name} />
                    </span>
                    <span className="icon-grid__name">{name}</span>
                </li>
            ))}
        </ul>
    ),
};

export default meta;
export { Set, Single };
