#!/usr/bin/env node
// Searches the front matter of the ADRs and the specs. Run from the root of the repository.
//   node .agents/skills/find-docs/find.mjs                  every ADR and spec, a short summary each
//   node .agents/skills/find-docs/find.mjs ADR-0016 | 16    one ADR, what changes it and the specs that describe it
//   node .agents/skills/find-docs/find.mjs src/lib/offline  the specs whose code holds that path, and their ADRs
//   node .agents/skills/find-docs/find.mjs groups balance   the files whose tags or summary hold every word
//   add --all to include the superseded and rejected ADRs in a search
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = process.cwd();
if (!existsSync(`${root}/docs/adr`)) {
    console.error('Run it from the root of the repository.');
    process.exit(1);
}

const parse = (text) => {
    const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
    const fields = {};
    for (const line of match ? match[1].split('\n') : []) {
        const pair = /^([a-z_]+): (.+)$/.exec(line);
        if (!pair) continue;
        let value = pair[2];
        if (value.startsWith('['))
            value = value
                .slice(1, -1)
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        else if (value.startsWith("'")) value = value.slice(1, -1).replaceAll("''", "'");
        else if (value.startsWith('"')) value = value.slice(1, -1).replace(/\\(.)/g, '$1');
        fields[pair[1]] = value;
    }
    const title = /^# (.+)$/m.exec(text)?.[1] ?? '';
    return { ...fields, title };
};

const load = (folder, kind) =>
    readdirSync(`${root}/${folder}`)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort()
        .map((name) => ({
            kind,
            name,
            path: `${folder}/${name}`,
            ...parse(readFileSync(`${root}/${folder}/${name}`, 'utf8')),
        }));

const adrs = load('docs/adr', 'adr').map((adr) => ({ ...adr, id: `ADR-${adr.name.slice(0, 4)}` }));
const specs = load('docs/specs', 'spec');
const list = (value) => (Array.isArray(value) ? value : []);

const SHORT = 160;

const line = (doc, short = false) => {
    const tags = list(doc.tags).join(',');
    const summary = short && doc.summary.length > SHORT ? `${doc.summary.slice(0, SHORT - 1)}…` : doc.summary;
    if (doc.kind === 'spec') return `${doc.path}  [${tags}]\n    ${summary}`;
    const status = doc.status === 'Superseded' ? `Superseded by ${doc.superseded_by}` : doc.status;
    return `${doc.path}  (${status}) [${tags}]\n    ${summary}`;
};

// An ADR and a spec are joined when the spec links to the ADR or the ADR names the spec
const specsOf = (adr) =>
    specs
        .filter((spec) => list(spec.adrs).includes(adr.id) || list(adr.specs).includes(spec.name))
        .map((spec) => spec.name);
const adrsOf = (spec) =>
    adrs.filter((adr) => list(spec.adrs).includes(adr.id) || list(adr.specs).includes(spec.name)).map((adr) => adr.id);

const args = process.argv.slice(2);
const all = args.includes('--all');
const words = args.filter((arg) => arg !== '--all');
const live = (doc) => all || doc.kind === 'spec' || !['Superseded', 'Rejected'].includes(doc.status);

const showAdr = (adr) => {
    console.log(line(adr));
    const refinedBy = adrs.filter((other) => list(other.refines).includes(adr.id)).map((other) => other.id);
    const supersededBy = adrs.filter((other) => list(other.supersedes).includes(adr.id)).map((other) => other.id);
    if (list(adr.refines).length) console.log(`    refines: ${list(adr.refines).join(', ')}`);
    if (list(adr.supersedes).length) console.log(`    supersedes: ${list(adr.supersedes).join(', ')}`);
    if (refinedBy.length) console.log(`    refined by: ${refinedBy.join(', ')}  <- read these too, they change it`);
    if (supersededBy.length) console.log(`    superseded by: ${supersededBy.join(', ')}`);
    if (specsOf(adr).length) console.log(`    specs: ${specsOf(adr).join(', ')}`);
};

if (words.length === 0) {
    for (const doc of [...adrs, ...specs]) console.log(line(doc, true));
    process.exit(0);
}

const query = words.join(' ');
const number = /^(?:ADR-?)?(\d{1,4})$/i.exec(query);
if (number) {
    const adr = adrs.find((doc) => doc.id === `ADR-${number[1].padStart(4, '0')}`);
    if (!adr) {
        console.error(`No ${query}.`);
        process.exit(1);
    }
    showAdr(adr);
    process.exit(0);
}

const path = query.replace(/^\.\//, '');
const isPath =
    words.length === 1 &&
    (path.includes('/') || specs.some((spec) => list(spec.code).some((code) => code.startsWith(path))));
if (isPath) {
    const depth = (spec) =>
        Math.max(
            0,
            ...list(spec.code)
                .filter((code) => path.startsWith(code) || code.startsWith(path))
                .map((code) => code.length)
        );
    const matches = specs.filter((spec) => depth(spec) > 0).sort((a, b) => depth(b) - depth(a));
    if (matches.length === 0) console.log(`No spec names ${path} in its code; try a word of what it does.`);
    for (const spec of matches) {
        console.log(line(spec));
        if (adrsOf(spec).length) console.log(`    adrs: ${adrsOf(spec).join(', ')}`);
    }
    process.exit(0);
}

const lower = words.map((word) => word.toLowerCase());
const matches = [...adrs, ...specs].filter((doc) => {
    if (!live(doc)) return false;
    const haystack = [doc.title, doc.summary, ...list(doc.tags)].join(' ').toLowerCase();
    return lower.every((word) => haystack.includes(word));
});
if (matches.length === 0) console.log('Nothing in the front matter; search the bodies: grep -ril "<word>" docs/');
for (const doc of matches) console.log(line(doc));
