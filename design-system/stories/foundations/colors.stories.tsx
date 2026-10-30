import { Button } from '@/components/button/button';
import { ACCENTS, DEFAULT_ACCENT } from '@/lib/accent';

import { splitLightDark, tokensWith, type Token } from './tokens';

import type { Meta } from '@storybook/react-vite';

import './foundations.css';

interface SwatchesProps {
    tokens: Token[];
}

const Swatches = (props: SwatchesProps) => {
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
};

const Story: Meta = {
    title: 'Foundations/Colors',
    parameters: { layout: 'padded' },
};

export const Semantic = () => {
    return <Swatches tokens={tokensWith('--color-').filter((token) => !token.name.startsWith('--color-category-'))} />;
};

export const Category = () => {
    return <Swatches tokens={tokensWith('--color-category-')} />;
};

export const Accents = () => {
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
};

export default Story;
