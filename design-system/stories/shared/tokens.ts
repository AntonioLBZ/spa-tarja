import tokensCss from '@/assets/styles/tokens.css?raw';

interface Token {
    name: string;
    value: string;
}

const DECLARATION = /^\s*(--[\w-]+):\s*(.+);$/gm;

const declarationsOf = (block: string): Token[] => {
    return Array.from(block.matchAll(DECLARATION), (match) => {
        const [, name = '', value = ''] = match;
        return { name, value };
    });
};

// The rule of a selector, up to its closing brace
const blockOf = (selector: string): string => {
    const start = tokensCss.indexOf(`${selector} {`);
    return start < 0 ? '' : tokensCss.slice(start, tokensCss.indexOf('\n}', start));
};

// The first `:root` block is where the tokens are defined; the blocks after it only override some of them
const TOKENS: readonly Token[] = declarationsOf(blockOf(':root'));

const tokensWith = (prefix: string): Token[] => {
    return TOKENS.filter((token) => token.name.startsWith(prefix));
};

// What the rule of a selector sets, as the palette for color blindness
const tokensUnder = (selector: string): Token[] => {
    return declarationsOf(blockOf(selector));
};

// What a `light-dark()` token holds for each theme, or null for a token that is not one
const splitLightDark = (value: string): { light: string; dark: string } | null => {
    const match = /^light-dark\((.+),\s*(.+)\)$/.exec(value);
    return match ? { light: match[1] ?? '', dark: match[2] ?? '' } : null;
};

export { splitLightDark, tokensUnder, tokensWith, type Token };
