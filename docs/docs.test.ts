import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function repoPath(path: string): string {
    return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

function filesIn(folder: string, pattern: RegExp): string[] {
    return readdirSync(repoPath(folder))
        .filter((name) => pattern.test(name))
        .sort();
}

function read(path: string): string {
    return readFileSync(repoPath(path), 'utf8');
}

function indexedFiles(): string[] {
    const section = read('AGENTS.md')
        .split(/^## /m)
        .find((part) => part.startsWith('Source of truth'));
    return (section ?? '')
        .split('\n')
        .filter((line) => /^ {4,}- /.test(line))
        .flatMap((line) => [...line.matchAll(/`([\w-]+\.md)`/g)].flatMap((match) => match.slice(1)))
        .sort();
}

const adrs = filesIn('docs/adr', /^\d{4}-.*\.md$/);
const specs = filesIn('docs/specs', /\.md$/);

describe('the index in AGENTS.md', () => {
    const indexed = indexedFiles();

    it('lists every ADR and every spec', () => {
        expect([...adrs, ...specs].filter((name) => !indexed.includes(name))).toEqual([]);
    });

    it('lists only files that exist', () => {
        expect(indexed.filter((name) => !adrs.includes(name) && !specs.includes(name))).toEqual([]);
    });

    it('lists each file once', () => {
        expect(indexed.filter((name, position) => indexed.indexOf(name) !== position)).toEqual([]);
    });
});

describe('the ADRs', () => {
    it('are numbered one after another from 1', () => {
        expect(adrs.map((name) => Number(name.slice(0, 4)))).toEqual(adrs.map((_, position) => position + 1));
    });

    it.each(adrs)('%s is headed with its number and has a status', (name) => {
        const text = read(`docs/adr/${name}`);

        expect(text).toMatch(new RegExp(`^# ADR-${name.slice(0, 4)}: .+`));
        expect(text).toMatch(/^- Status: (Accepted|Rejected|Proposed|Superseded by ADR-\d{4})$/m);
        expect(text).toMatch(/^- Date: \d{4}-\d{2}-\d{2}$/m);
    });
});
