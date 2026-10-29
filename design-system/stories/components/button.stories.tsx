import { Button } from '@/components/button/button';

import type { Meta, StoryObj } from '@storybook/react-vite';

const VARIANTS = ['default', 'primary', 'danger'] as const;

const meta = {
    title: 'Components/Button',
    component: Button,
    args: { children: 'Save' },
    argTypes: { variant: { control: 'inline-radio', options: VARIANTS } },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

const Primary: Story = { args: { variant: 'primary' } };

const Danger: Story = { args: { variant: 'danger', children: 'Delete' } };

const Pressed: Story = { args: { pressed: true, children: 'Filter' } };

const Disabled: Story = { args: { disabled: true } };

const Glyph: Story = { args: { glyph: true, 'aria-label': 'Next', children: '→' } };

// Every variant in every state
const Matrix: Story = {
    render: () => (
        <div style={{ display: 'grid', gap: 'var(--size-4)', justifyItems: 'start' }}>
            {VARIANTS.map((variant) => (
                <div
                    key={variant}
                    style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 'var(--size-4)' }}
                >
                    <Button variant={variant}>Normal</Button>
                    <Button variant={variant} pressed>
                        Pressed
                    </Button>
                    <Button variant={variant} disabled>
                        Disabled
                    </Button>
                    <Button variant={variant} glyph aria-label="Next">
                        →
                    </Button>
                </div>
            ))}
        </div>
    ),
};

export default meta;
export { Danger, Default, Disabled, Glyph, Matrix, Pressed, Primary };
