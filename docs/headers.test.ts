import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const { SECURITY_HEADERS } = (await import(new URL('../server/headers.ts', import.meta.url).href)) as {
    SECURITY_HEADERS: readonly (readonly [string, string])[];
};

const { SCRIPT_HASHES_MARKER, inlineScriptHashes, withScriptHashes } = (await import(
    new URL('../csp.config.ts', import.meta.url).href
)) as {
    SCRIPT_HASHES_MARKER: string;
    inlineScriptHashes: (html: string) => string[];
    withScriptHashes: (headers: string, html: string) => string;
};

interface BuildPlugin {
    name?: string;
    writeBundle?: { handler: (options: { dir: string }) => void };
}

const { default: viteConfig } = (await import(new URL('../vite.config.ts', import.meta.url).href)) as {
    default: { plugins: unknown[] };
};

const outDir = mkdtempSync(join(tmpdir(), 'headers-'));

afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
});

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

const parse = (file: string) => {
    const lines = file.split('\n').filter((line) => line.trim() !== '');
    expect(lines.filter((line) => !line.startsWith(' '))).toEqual(['/*']);
    return new Map(
        lines.slice(1).map((line) => {
            const [name = '', ...value] = line.trim().split(': ');
            return [name.toLowerCase(), value.join(': ')] as const;
        })
    );
};

const directives = (policy: string) => {
    return Object.fromEntries(
        policy.split(';').map((directive) => {
            const [name = '', ...sources] = directive.trim().split(' ');
            return [name, sources];
        })
    ) as Record<string, string[]>;
};

const sha256 = (text: string) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

const staticHeaders = () => parse(read('public/_headers'));

describe('the headers of the static files', () => {
    it('hold every header the Worker sets, for every path', () => {
        const headers = staticHeaders();

        for (const [name, value] of SECURITY_HEADERS) {
            if (name === 'Content-Security-Policy') continue;
            expect(headers.get(name.toLowerCase()), name).toBe(value);
        }
    });

    it('keep every answer of the Worker from being framed, and from loading anything but a style it holds', () => {
        const policy = SECURITY_HEADERS.find(([name]) => name === 'Content-Security-Policy')?.[1] ?? '';

        expect(directives(policy)).toEqual({
            'default-src': ["'none'"],
            'style-src': ["'unsafe-inline'"],
            'frame-ancestors': ["'none'"],
        });
    });

    it('keep the page from being framed', () => {
        const policy = directives(staticHeaders().get('content-security-policy') ?? '');

        expect(policy['frame-ancestors']).toEqual(["'none'"]);
    });

    it('set no header the Worker does not', () => {
        const worker = new Set(SECURITY_HEADERS.map(([name]) => name.toLowerCase()));

        expect([...staticHeaders().keys()].filter((name) => !worker.has(name))).toEqual([]);
    });

    it('keep the line of the policy under the 2000 characters Cloudflare reads', () => {
        const line = read('public/_headers')
            .split('\n')
            .find((text) => text.includes('Content-Security-Policy')) as string;
        const hashed = withScriptHashes(line, read('index.html'));

        expect(hashed.length).toBeLessThan(2000);
    });
});

describe('the policy of the pages', () => {
    const policy = () => directives(staticHeaders().get('content-security-policy') ?? '');

    it('allows what the app loads and nothing else', () => {
        expect(policy()).toEqual({
            'default-src': ["'self'"],
            'script-src': ["'self'", SCRIPT_HASHES_MARKER],
            'style-src': ["'self'"],
            'img-src': ["'self'", 'data:'],
            'font-src': ["'self'", 'data:'],
            'connect-src': ["'self'"],
            'manifest-src': ["'self'"],
            'worker-src': ["'self'"],
            'object-src': ["'none'"],
            'base-uri': ["'none'"],
            'form-action': ["'self'"],
            'frame-ancestors': ["'none'"],
        });
    });

    it('runs no script from a string and no script written in the page but its own', () => {
        const { 'script-src': scripts = [] } = policy();

        expect(scripts).not.toContain("'unsafe-inline'");
        expect(scripts).not.toContain("'unsafe-eval'");
        expect(scripts.filter((source) => source.startsWith("'sha256-"))).toEqual([]);
    });

    it('holds the marker once, in the sources of the scripts', () => {
        expect(read('public/_headers').split(SCRIPT_HASHES_MARKER)).toHaveLength(2);
    });

    it('gets the hash of the inline script of index.html', () => {
        const html = read('index.html');
        const start = html.indexOf('<script>') + '<script>'.length;
        const code = html.slice(start, html.indexOf('</script>'));

        expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<script type="module"'));
        expect(code).toContain('tarja:theme');
        expect(inlineScriptHashes(html)).toEqual([sha256(code)]);
        expect(withScriptHashes(read('public/_headers'), html)).toContain(`script-src 'self' '${sha256(code)}';`);
    });

    it('gets no hash for the script that is a file', () => {
        expect(inlineScriptHashes('<script type="module" crossorigin src="/assets/index.js"></script>')).toEqual([]);
    });
});

describe('the hash of an inline script', () => {
    it('is the SHA-256 of the text between the tags, in base64', () => {
        expect(inlineScriptHashes('<head><script>alert(1)</script></head>')).toEqual([
            'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI=',
        ]);
    });

    it('keeps the spaces and the line breaks of the script', () => {
        expect(inlineScriptHashes('<script>\n    alert(1)\n</script>')).toEqual([sha256('\n    alert(1)\n')]);
    });

    it('is the one of a browser, which reads a CRLF as a line feed', () => {
        expect(inlineScriptHashes('<script>a\r\nb</script>')).toEqual([
            'sha256-fhj3NzEbLcOy8mndeDlrA1HxT7Zu+oefdoyyMYGIPHg=',
        ]);
    });

    it('is one for each script, whatever its attributes, and none for a file', () => {
        const html = [
            '<script>one()</script>',
            '<script src="/a.js"></script>',
            '<SCRIPT type="module">two()</SCRIPT>',
            "<script async src='/b.js'></script>",
        ].join('\n');

        expect(inlineScriptHashes(html)).toEqual([sha256('one()'), sha256('two()')]);
    });
});

describe('the headers of a build', () => {
    const headers = `/*\n  Content-Security-Policy: script-src 'self' ${SCRIPT_HASHES_MARKER}; img-src 'self'\n`;

    it('take the hash of each inline script in place of the marker', () => {
        const built = withScriptHashes(headers, '<script>one()</script><script>two()</script>');

        expect(built).toBe(
            `/*\n  Content-Security-Policy: script-src 'self' '${sha256('one()')}' '${sha256('two()')}'; img-src 'self'\n`
        );
    });

    it('lose the marker when the page has no inline script', () => {
        const built = withScriptHashes(headers, '<script src="/a.js"></script>');

        expect(built).toBe("/*\n  Content-Security-Policy: script-src 'self'; img-src 'self'\n");
    });

    it('fail when the marker is gone, since the hashes would reach nothing', () => {
        expect(() =>
            withScriptHashes("/*\n  Content-Security-Policy: script-src 'self'\n", '<script>a()</script>')
        ).toThrow(SCRIPT_HASHES_MARKER);
    });
});

describe('the build', () => {
    const plugin = () => {
        const plugins = viteConfig.plugins.flat(Infinity) as BuildPlugin[];
        return plugins.find((candidate) => candidate?.name === 'tarja-content-security-policy');
    };

    it('registers the step that puts the hashes of the inline scripts in the policy', () => {
        expect(plugin()).toBeDefined();
    });

    it('leaves no marker in the headers it writes', () => {
        const html = read('index.html');
        writeFileSync(join(outDir, 'index.html'), html);
        writeFileSync(join(outDir, '_headers'), read('public/_headers'));

        plugin()?.writeBundle?.handler({ dir: outDir });

        const built = readFileSync(join(outDir, '_headers'), 'utf8');
        expect(built).not.toContain(SCRIPT_HASHES_MARKER);
        expect(built).toContain(`'${inlineScriptHashes(html)[0]}'`);
    });
});
