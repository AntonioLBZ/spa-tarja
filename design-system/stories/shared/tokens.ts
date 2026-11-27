import tokensCss from '@/assets/styles/tokens.css?raw';
import { blockOf, declarationsOf, splitLightDark, type Token } from '@storybook-config/token-values';

// The rule of a selector among the tokens
const blockOfTokens = (selector: string): string => blockOf(tokensCss, selector);

// The first `:root` block is where the tokens are defined; the blocks after it only override some of them
const TOKENS: readonly Token[] = declarationsOf(blockOfTokens(':root'));

const tokensWith = (prefix: string): Token[] => {
    return TOKENS.filter((token) => token.name.startsWith(prefix));
};

// What the rule of a selector sets, as the palette for color blindness
const tokensUnder = (selector: string): Token[] => {
    return declarationsOf(blockOfTokens(selector));
};

export { splitLightDark, tokensUnder, tokensWith, type Token };
