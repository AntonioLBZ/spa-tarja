import { Button } from '@/components/button/button';
import { ACCENTS, DEFAULT_ACCENT } from '@/lib/accent';

import { splitLightDark, tokensWith, type Token } from './tokens';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './foundations.css';

function Swatches(props: { tokens: Token[] }) {
    const { tokens } = props;

    return (
        <ul className="swatch-grid">
            {tokens.map((token) => {
                const pair = splitLightDark(token.value);
                return (
                    <li className="swatch" key={token.name}>
                        <div className="swatch__chip" style={{ background: `var(${token.name})` }} />
                        <span className="swatch__name">{token.name}</span>
                        <span className="swatch__value">
                            {pair ? `light ${pair.light} · dark ${pair.dark}` : token.value}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function AccentSamples() {
    return (
        <div>
            {ACCENTS.map((accent) => (
                <div
                    className="accent-sample"
                    data-accent={accent === DEFAULT_ACCENT ? undefined : accent}
                    key={accent}
                >
                    <span className="accent-sample__chip" />
                    <span className="accent-sample__name">{accent}</span>
                    <Button variant="primary">Save</Button>
                    <Button pressed>Pressed</Button>
                    <a href="#accent">A link</a>
                </div>
            ))}
        </div>
    );
}

const meta = {
    title: 'Foundations/Colors',
    parameters: { layout: 'padded' },
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Semantic: Story = {
    render: () => (
        <Swatches tokens={tokensWith('--color-').filter((token) => !token.name.startsWith('--color-category-'))} />
    ),
};

const Category: Story = {
    render: () => <Swatches tokens={tokensWith('--color-category-')} />,
};

const Accents: Story = {
    render: () => <AccentSamples />,
};

export default meta;
export { Accents, Category, Semantic };
