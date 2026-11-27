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

// The rule of a selector in a stylesheet, up to its closing brace
const blockOf = (css: string, selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? '' : css.slice(start, css.indexOf('\n}', start));
};

// What a `light-dark()` token holds for each theme, or null for a token that is not one
const splitLightDark = (value: string): { light: string; dark: string } | null => {
    const match = /^light-dark\((.+),\s*(.+)\)$/.exec(value);
    return match ? { light: match[1] ?? '', dark: match[2] ?? '' } : null;
};

export { blockOf, declarationsOf, splitLightDark, type Token };
