import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface D1Binding {
    binding: string;
    database_name: string;
    database_id: string;
}

interface WranglerConfig {
    d1_databases: D1Binding[];
    env?: {
        prerelease?: {
            workers_dev?: boolean;
            routes?: unknown[];
            d1_databases?: D1Binding[];
        };
    };
}

const read = (path: string) => {
    return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
};

const files = (folder: string) => {
    const path = fileURLToPath(new URL(`../${folder}`, import.meta.url));
    if (!existsSync(path)) return [];
    return readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name !== '_headers')
        .map((entry) => entry.name)
        .sort();
};

const wrangler = () => {
    const { config, error } = ts.parseConfigFileTextToJson('wrangler.jsonc', read('wrangler.jsonc'));
    expect(error).toBeUndefined();
    return config as WranglerConfig;
};

const scripts = () => {
    return (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
};

describe('the prerelease environment', () => {
    it('binds a database of its own as DB', () => {
        const config = wrangler();
        const databases = config.env?.prerelease?.d1_databases ?? [];

        expect(databases).toHaveLength(1);
        expect(databases[0]).toMatchObject({ binding: 'DB', database_name: 'tarja-prerelease' });
        expect(databases[0]?.database_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(databases[0]?.database_id).not.toBe(config.d1_databases[0]?.database_id);
    });

    it('never mentions the production database id', () => {
        const config = wrangler();
        const production = config.d1_databases[0]?.database_id ?? '';

        expect(production).not.toBe('');
        expect(config.env?.prerelease).toBeDefined();
        expect(JSON.stringify(config.env?.prerelease)).not.toContain(production);
    });

    it('is served on its own custom domain and not on workers.dev', () => {
        const prerelease = wrangler().env?.prerelease;

        expect(prerelease?.workers_dev).toBe(false);
        expect(prerelease?.routes).toEqual([{ pattern: 'tarja-prerelease.albz.app', custom_domain: true }]);
    });
});

describe('the prerelease scripts', () => {
    it('migrate the prerelease database only', () => {
        expect(scripts()['db:migrate:prerelease']).toBe('wrangler d1 migrations apply DB --remote --env prerelease');
    });

    it('build for the prerelease before they migrate and deploy', () => {
        expect(scripts()['deploy:prerelease']).toBe(
            'CLOUDFLARE_ENV=prerelease pnpm build && pnpm db:migrate:prerelease && wrangler deploy --env prerelease'
        );
    });

    it('leave the production scripts alone', () => {
        expect(scripts()['deploy:prod']).toBe('pnpm build && wrangler deploy');
        expect(scripts()['db:migrate:remote']).toBe('wrangler d1 migrations apply DB --remote');
    });
});

describe('the prerelease icons', () => {
    it('are the same files as the production icons', () => {
        expect(files('public/prerelease')).toEqual(files('public'));
    });

    it('draw the line red instead of blue', () => {
        const prerelease = read('public/prerelease/favicon.svg');

        expect(prerelease).toContain('#ff6b6b');
        expect(prerelease).not.toContain('#8aa4ff');
        expect(read('public/favicon.svg')).toContain('#8aa4ff');
    });
});
