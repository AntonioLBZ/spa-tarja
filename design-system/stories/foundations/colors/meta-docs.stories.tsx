import { resolveToken, splitLightDark, tokensUnder, tokensWith, type Token } from '@stories/shared/tokens';

import type { Meta } from '@storybook/react-vite';
import type { CSSProperties } from 'react';

import './colors.css';

const GROUPS = ['--color-bg-', '--color-content-', '--color-border', '--color-money-', '--color-category-'];

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
                        <div className="swatch__chip" style={{ '--swatch': `var(${token.name})` } as CSSProperties} />
                        <span className="swatch__name">{token.name}</span>
                        <span className="swatch__value">
                            {pair ? `light ${pair.light} · dark ${resolveToken(pair.dark)}` : token.value}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

const Story: Meta = {
    title: 'Foundations/Colors',
    tags: ['!dev'],
};

export const Backgrounds = () => {
    return <Swatches tokens={tokensWith('--color-bg-')} />;
};

export const Content = () => {
    return <Swatches tokens={tokensWith('--color-content-')} />;
};

export const Borders = () => {
    return <Swatches tokens={tokensWith('--color-border')} />;
};

export const Rest = () => {
    return (
        <Swatches
            tokens={tokensWith('--color-').filter((token) => !GROUPS.some((group) => token.name.startsWith(group)))}
        />
    );
};

export const DarkTones = () => {
    return (
        <div className="swatch-tones">
            <Swatches tokens={tokensWith('--dark-')} />
            <div data-dark-tone="oled">
                <Swatches tokens={tokensUnder("[data-dark-tone='oled']")} />
            </div>
        </div>
    );
};

export const Amounts = () => {
    return <Swatches tokens={tokensWith('--color-money-')} />;
};

export const AmountsColorBlind = () => {
    return (
        <div data-money-palette="color-blind">
            <Swatches tokens={tokensUnder("[data-money-palette='color-blind']")} />
        </div>
    );
};

export const Categories = () => {
    return <Swatches tokens={tokensWith('--color-category-')} />;
};

export default Story;
