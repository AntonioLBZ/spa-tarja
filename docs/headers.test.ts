import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const { SECURITY_HEADERS } = (await import(new URL('../server/headers.ts', import.meta.url).href)) as {
    SECURITY_HEADERS: readonly (readonly [string, string])[];
};

const staticHeaders = () => {
    const file = readFileSync(fileURLToPath(new URL('../public/_headers', import.meta.url)), 'utf8');
    const lines = file.split('\n').filter((line) => line.trim() !== '');
    expect(lines[0]).toBe('/*');
    expect(lines.filter((line) => !line.startsWith(' '))).toEqual(['/*']);
    return new Map(
        lines.slice(1).map((line) => {
            const [name = '', ...value] = line.trim().split(': ');
            return [name.toLowerCase(), value.join(': ')] as const;
        })
    );
};

describe('the headers of the static files', () => {
    it('hold every header the Worker sets, for every path', () => {
        const headers = staticHeaders();

        for (const [name, value] of SECURITY_HEADERS) {
            if (name === 'Content-Security-Policy') continue;
            expect(headers.get(name.toLowerCase()), name).toBe(value);
        }
    });

    it('keep the page from being framed', () => {
        const policy = staticHeaders().get('content-security-policy') ?? '';

        expect(policy.split(';').map((directive) => directive.trim())).toContain("frame-ancestors 'none'");
    });

    it('set no header the Worker does not', () => {
        const worker = new Set(SECURITY_HEADERS.map(([name]) => name.toLowerCase()));

        expect([...staticHeaders().keys()].filter((name) => !worker.has(name))).toEqual([]);
    });
});
