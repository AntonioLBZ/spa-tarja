import { Brand } from '@/components/brand/brand';

import { tokensWith } from './tokens';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './foundations.css';

const SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789';

const meta = {
    title: 'Foundations/Typography',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Scale: Story = {
    render: () => (
        <div>
            {tokensWith('--font-size-')
                .filter((token) => token.name !== '--font-size-logo')
                .map((token) => (
                    <div className="type-sample" key={token.name}>
                        <span className="type-sample__meta">
                            {token.name} · {token.value}
                        </span>
                        <p className="type-sample__text" style={{ fontSize: `var(${token.name})` }}>
                            {SAMPLE}
                        </p>
                    </div>
                ))}
        </div>
    ),
};

const Weights: Story = {
    render: () => (
        <div>
            {[400, 700].map((weight) => (
                <div className="type-sample" key={weight}>
                    <span className="type-sample__meta">IBM Plex Mono · {weight}</span>
                    <p className="type-sample__text" style={{ fontWeight: weight }}>
                        {SAMPLE}
                    </p>
                </div>
            ))}
        </div>
    ),
};

const Logo: Story = {
    render: () => (
        <div>
            <div className="type-sample">
                <span className="type-sample__meta">--font-family-brand, in the header</span>
                <Brand />
            </div>
            <div className="type-sample">
                <span className="type-sample__meta">--font-size-logo, as the hero</span>
                <Brand size="hero" />
            </div>
        </div>
    ),
};

export default meta;
export { Logo, Scale, Weights };
