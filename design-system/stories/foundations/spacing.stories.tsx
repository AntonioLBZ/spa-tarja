import { tokensWith } from './tokens';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './foundations.css';

const meta = {
    title: 'Foundations/Spacing',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Scale: Story = {
    render: () => (
        <div>
            {tokensWith('--size-').map((token) => (
                <div className="spacing-row" key={token.name}>
                    <span>{token.name}</span>
                    <span className="spacing-row__value">{token.value}</span>
                    <div className="spacing-row__bar" style={{ inlineSize: `var(${token.name})` }} />
                </div>
            ))}
        </div>
    ),
};

export default meta;
export { Scale };
