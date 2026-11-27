import { blockOf, declarationsOf, splitLightDark } from './token-values';

type Mode = 'light' | 'dark' | 'black';

interface Palette {
    font: string;
    colors: Record<Mode, Record<string, string>>;
}

const BLACK_TONE = ":root[data-dark-tone='black']";

// The colors of the tokens for each theme, with the tokens that point at another one resolved: dark is the standard
// tone, black the dark theme with the black tone's surfaces
const paletteOf = (css: string): Palette => {
    const tokens = new Map(declarationsOf(blockOf(css, ':root')).map((token) => [token.name, token.value]));
    const blackTokens = new Map([
        ...tokens,
        ...declarationsOf(blockOf(css, BLACK_TONE)).map((token) => [token.name, token.value] as const),
    ]);
    const resolveIn =
        (from: Map<string, string>) =>
        (value: string): string => {
            const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
            return reference ? resolveIn(from)(from.get(reference) ?? '') : value;
        };
    const resolve = resolveIn(tokens);
    const resolveBlack = resolveIn(blackTokens);
    const colors: Palette['colors'] = { light: {}, dark: {}, black: {} };
    for (const [name, value] of tokens) {
        const split = name.startsWith('--color-') ? splitLightDark(resolve(value)) : null;
        if (!split) continue;
        colors.light[name] = resolve(split.light);
        colors.dark[name] = resolve(split.dark);
        colors.black[name] = resolveBlack(split.dark);
    }
    return { font: tokens.get('--font-family') ?? 'monospace', colors };
};

export { paletteOf, type Mode, type Palette };
