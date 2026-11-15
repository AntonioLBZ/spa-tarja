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

// The amount colors of the palette for color blindness, which a mark on the root swaps in (ADR-0028)
export const AmountColorBlind = () => {
    return (
        <div data-money-palette="color-blind">
            <Swatches
                tokens={[
                    { name: '--color-money-in', value: 'light-dark(#1d4ed8, #8aa4ff)' },
                    { name: '--color-money-out', value: 'light-dark(#9a4a00, #fb923c)' },
                ]}
            />
        </div>
    );
};

export default Story;
