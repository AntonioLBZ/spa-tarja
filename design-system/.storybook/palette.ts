import { blockOf, declarationsOf, splitLightDark } from './token-values';

type Mode = 'light' | 'dark';

interface Palette {
    font: string;
    colors: Record<Mode, Record<string, string>>;
}

// The colors of the tokens for each theme, with the tokens that point at another one resolved
const paletteOf = (css: string): Palette => {
    const tokens = new Map(declarationsOf(blockOf(css, ':root')).map((token) => [token.name, token.value]));
    const resolve = (value: string): string => {
        const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
        return reference ? resolve(tokens.get(reference) ?? '') : value;
    };
    const colors: Palette['colors'] = { light: {}, dark: {} };
    for (const [name, value] of tokens) {
        const split = name.startsWith('--color-') ? splitLightDark(resolve(value)) : null;
        if (!split) continue;
        colors.light[name] = split.light;
        colors.dark[name] = split.dark;
    }
    return { font: tokens.get('--font-family') ?? 'monospace', colors };
};

export { paletteOf, type Mode, type Palette };
