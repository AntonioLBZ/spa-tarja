import tokensCss from '@/assets/styles/tokens.css?raw';

interface Token {
    name: string;
    value: string;
}

// The first `:root` block is where the tokens are defined; the accent presets after it only override one of them
const ROOT_BLOCK = tokensCss.slice(0, tokensCss.indexOf('\n}'));

const TOKENS: readonly Token[] = Array.from(ROOT_BLOCK.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm), (match) => {
    const [, name = '', value = ''] = match;
    return { name, value };
});

function tokensWith(prefix: string): Token[] {
    return TOKENS.filter((token) => token.name.startsWith(prefix));
}

// What a `light-dark()` token holds for each theme, or null for a token that is not one
function splitLightDark(value: string): { light: string; dark: string } | null {
    const match = /^light-dark\((.+),\s*(.+)\)$/.exec(value);
    return match ? { light: match[1] ?? '', dark: match[2] ?? '' } : null;
}

export { splitLightDark, tokensWith };
export type { Token };
