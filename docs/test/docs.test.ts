import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type FrontMatter = Record<string, string | string[]>;

const repoPath = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

const filesIn = (folder: string, pattern: RegExp) =>
    readdirSync(repoPath(folder))
        .filter((name) => pattern.test(name))
        .sort();

const read = (path: string) => readFileSync(repoPath(path), 'utf8');

const parseValue = (raw: string): string | string[] => {
    if (raw.startsWith('[') && raw.endsWith(']')) {
        const inside = raw.slice(1, -1).trim();
        return inside === '' ? [] : inside.split(',').map((item) => item.trim());
    }
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/\\(.)/g, '$1');
    return raw;
};

const splitFrontMatter = (text: string) => {
    const match = /^---\n([\s\S]*?)\n---\n\n/.exec(text);
    if (!match) return { frontMatter: null, raw: {} as Record<string, string>, body: text };
    const frontMatter: FrontMatter = {};
    const raw: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const pair = /^([a-z_]+): (.+)$/.exec(line);
        if (!pair) throw new Error(`Not a line of front matter: ${line}`);
        raw[pair[1]] = pair[2];
        frontMatter[pair[1]] = parseValue(pair[2]);
    }
    return { frontMatter, raw, body: text.slice(match[0].length) };
};

const list = (value: string | string[] | undefined) => (Array.isArray(value) ? value : []);

const isQuoted = (raw: string | undefined) => /^'.*'$|^".*"$/.test(raw ?? '');

const isDay = (value: string | string[] | undefined) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const adrs = filesIn('docs/adr', /^\d{4}-.*\.md$/);
const specs = filesIn('docs/specs', /\.md$/);
const adrIds = adrs.map((name) => `ADR-${name.slice(0, 4)}`);
const idOf = (name: string) => `ADR-${name.slice(0, 4)}`;

const tags = [
    ...read('docs/README.md')
        .split(/^## Tags$/m)[1]
        .matchAll(/^- `([a-z0-9-]+)`:/gm),
].map((match) => match[1]);

const adrFiles = adrs.map((name) => ({ name, ...splitFrontMatter(read(`docs/adr/${name}`)) }));
const specFiles = specs.map((name) => ({ name, ...splitFrontMatter(read(`docs/specs/${name}`)) }));

describe('the ADRs', () => {
    it('are numbered one after another from 1', () => {
        expect(adrs.map((name) => Number(name.slice(0, 4)))).toEqual(adrs.map((_, position) => position + 1));
    });

    it.each(adrFiles)(
        '$name has its front matter and is headed with its number',
        ({ name, frontMatter, raw, body }) => {
            expect(frontMatter).not.toBeNull();
            const fields = frontMatter ?? {};
            expect(
                Object.keys(fields).filter(
                    (key) =>
                        ![
                            'status',
                            'superseded_by',
                            'date',
                            'supersedes',
                            'refines',
                            'tags',
                            'specs',
                            'summary',
                        ].includes(key)
                )
            ).toEqual([]);
            expect(fields.status).toMatch(/^(Accepted|Rejected|Proposed|Superseded)$/);
            expect(isDay(fields.date)).toBe(true);
            expect(typeof fields.summary === 'string' && fields.summary.length > 0).toBe(true);
            expect(isQuoted(raw.summary)).toBe(true);
            expect(list(fields.tags).length).toBeGreaterThan(0);
            expect(list(fields.tags).filter((tag) => !tags.includes(tag))).toEqual([]);
            expect(list(fields.specs).filter((spec) => !specs.includes(spec))).toEqual([]);
            expect(body).toMatch(new RegExp(`^# ${idOf(name)}: .+`));
            expect(body).not.toMatch(/^- (Status|Date): /m);
        }
    );

    it.each(adrFiles)('$name names only older ADRs that exist', ({ name, frontMatter }) => {
        const named = [...list(frontMatter?.supersedes), ...list(frontMatter?.refines)];
        expect(named.filter((id) => !adrIds.includes(id) || id >= idOf(name))).toEqual([]);
    });

    it.each(adrFiles)('$name is superseded only by an ADR that says it supersedes it', ({ name, frontMatter }) => {
        const by = frontMatter?.superseded_by;
        if (frontMatter?.status !== 'Superseded') {
            expect(by).toBeUndefined();
            return;
        }
        const successor = adrFiles.find((adr) => idOf(adr.name) === by);
        expect(list(successor?.frontMatter?.supersedes)).toContain(idOf(name));
    });

    it('list every ADR they supersede as superseded by them', () => {
        const wrong = adrFiles.flatMap(({ name, frontMatter }) =>
            list(frontMatter?.supersedes).filter(
                (id) => adrFiles.find((adr) => idOf(adr.name) === id)?.frontMatter?.superseded_by !== idOf(name)
            )
        );
        expect(wrong).toEqual([]);
    });
});

describe('the specs', () => {
    it.each(specFiles)('$name has its front matter', ({ frontMatter, raw, body }) => {
        expect(frontMatter).not.toBeNull();
        const fields = frontMatter ?? {};
        expect(Object.keys(fields).filter((key) => !['tags', 'adrs', 'code', 'summary'].includes(key))).toEqual([]);
        expect(typeof fields.summary === 'string' && fields.summary.length > 0).toBe(true);
        expect(isQuoted(raw.summary)).toBe(true);
        expect(list(fields.tags).length).toBeGreaterThan(0);
        expect(list(fields.tags).filter((tag) => !tags.includes(tag))).toEqual([]);
        expect(body).toMatch(/^# .+/);
    });

    it.each(specFiles)('$name lists every ADR it links to, and only those', ({ frontMatter, body }) => {
        const linked = [...new Set([...body.matchAll(/adr\/(\d{4})-/g)].map((match) => `ADR-${match[1]}`))].sort();
        expect([...list(frontMatter?.adrs)].sort()).toEqual(linked);
        expect(list(frontMatter?.adrs).filter((id) => !adrIds.includes(id))).toEqual([]);
    });

    it.each(specFiles)('$name links to ADRs by their exact file name', ({ body }) => {
        const files = [...body.matchAll(/adr\/(\d{4}-[^)#\s]*\.md)/g)].map((match) => match[1]);
        expect(files.filter((file) => !adrs.includes(file))).toEqual([]);
    });

    it.each(specFiles)('$name points only at code that exists', ({ frontMatter }) => {
        const code = list(frontMatter?.code);
        expect(code.length).toBeGreaterThan(0);
        expect(code.filter((path) => !existsSync(repoPath(path)))).toEqual([]);
        expect(
            code.filter(
                (path) => existsSync(repoPath(path)) && statSync(repoPath(path)).isDirectory() !== path.endsWith('/')
            )
        ).toEqual([]);
    });
});
