import tokensCss from '@/assets/styles/tokens.css?raw';
import { blockOf, declarationsOf, splitLightDark, type Token } from '@storybook-config/token-values';

// The rule of a selector among the tokens
const blockOfTokens = (selector: string): string => blockOf(tokensCss, selector);

// The first `:root` block is where the tokens are defined; the blocks after it only override some of them
const TOKENS: readonly Token[] = declarationsOf(blockOfTokens(':root'));

const tokensWith = (prefix: string): Token[] => {
    return TOKENS.filter((token) => token.name.startsWith(prefix));
};

// A value with the token it points at put in its place, as `var(--dark-bg-primary)`
const resolveToken = (value: string): string => {
    const reference = /^var\((--[\w-]+)\)$/.exec(value.trim())?.[1];
    return TOKENS.find((token) => token.name === reference)?.value ?? value;
};

// What the rule of a selector sets, as the palette for color blindness
const tokensUnder = (selector: string): Token[] => {
    return declarationsOf(blockOfTokens(selector));
};

export { resolveToken, splitLightDark, tokensUnder, tokensWith, type Token };
