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
    triggers?: { crons?: string[] };
    env?: {
        prerelease?: {
            triggers?: { crons?: string[] };
            workers_dev?: boolean;
            routes?: unknown[];
            d1_databases?: D1Binding[];
        };
    };
}

const read = (path: string) => {
    return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
};

const files = (folder: string) => {
    const path = fileURLToPath(new URL(`../../${folder}`, import.meta.url));
    if (!existsSync(path)) return [];
    return readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !['_headers', 'robots.txt'].includes(entry.name))
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

const workflow = (name: string) => {
    return read(`.github/workflows/${name}`);
};

// One job of a workflow: from its name to the next job, or to the end
const job = (text: string, name: string) => {
    const start = text.indexOf(`\n    ${name}:\n`);
    expect(start).toBeGreaterThan(-1);
    const next = text.slice(start + 1).search(/\n {4}[a-z-]+:\n/);
    return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
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

describe('the daily clean-up', () => {
    it('runs once a day in production and never in the prerelease', () => {
        const config = wrangler();
        expect(config.triggers?.crons).toEqual(['0 4 * * *']);
        expect(config.env?.prerelease?.triggers?.crons).toEqual([]);
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

describe('the prerelease workflow', () => {
    it('runs on a push to a branch other than main, and on nothing else', () => {
        const text = workflow('prerelease.yml');

        expect(text).toMatch(/\non:\n {4}push:\n {8}branches-ignore: \[main\]\n/);
        expect(text).not.toContain('pull_request');
    });

    it('deploys the prerelease and names no production script', () => {
        const text = workflow('prerelease.yml');

        expect(text).toContain('run: pnpm deploy:prerelease');
        expect(text).not.toContain('deploy:prod');
        expect(text).not.toContain('db:migrate:remote');
        expect(text).not.toContain('wrangler deploy');
    });

    it('runs one deploy at a time and lets it finish', () => {
        expect(workflow('prerelease.yml')).toContain(
            'concurrency:\n    group: prerelease\n    cancel-in-progress: false\n'
        );
    });

    it('holds the Cloudflare secrets only in the step that deploys', () => {
        const text = workflow('prerelease.yml');
        const deploy = text.indexOf('run: pnpm deploy:prerelease');

        expect(deploy).toBeGreaterThan(-1);
        expect(text.slice(0, deploy)).not.toContain('secrets.');
        expect(text.slice(deploy)).toContain('secrets.CLOUDFLARE_API_TOKEN');
        expect(text.slice(deploy)).toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
    });
});

describe('the version', () => {
    it('is MAJOR.MINOR.PATCH, which the settings show and the prerelease extends with its commit', () => {
        const { version } = JSON.parse(read('package.json')) as { version: string };

        expect(version).toMatch(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    });
});

describe('the version job', () => {
    it('runs on a push, after the checks, and asks whether the version is released', () => {
        const version = job(workflow('ci.yml'), 'version');

        expect(version).toContain('needs: check');
        expect(version).toContain("if: github.event_name == 'push'");
        expect(version).toContain('gh release view');
        expect(version).toContain('new: ${{ steps.release.outputs.new }}');
    });

    it('holds no secret and writes nothing', () => {
        const version = job(workflow('ci.yml'), 'version');

        expect(version).not.toContain('secrets.');
        expect(version).not.toContain('contents: write');
    });
});

describe('the release job', () => {
    it('is started by a push to main only, after the checks, and only for a new version', () => {
        const text = workflow('ci.yml');
        const release = job(text, 'release');

        expect(text).toMatch(/\non:\n {4}push:\n {8}branches: \[main\]\n {4}pull_request:\n {8}branches: \[main\]\n/);
        expect(release).toContain('needs: version');
        expect(release).toContain("if: github.event_name == 'push' && needs.version.outputs.new == 'true'");
    });

    it('applies the migrations before it deploys', () => {
        const release = job(workflow('ci.yml'), 'release');
        const migrate = release.indexOf('run: pnpm db:migrate:remote');
        const deploy = release.indexOf('run: pnpm deploy:prod');

        expect(migrate).toBeGreaterThan(-1);
        expect(deploy).toBeGreaterThan(migrate);
    });

    it('runs one release at a time and lets it finish', () => {
        expect(job(workflow('ci.yml'), 'release')).toContain(
            'concurrency:\n            group: release\n            cancel-in-progress: false\n'
        );
    });

    it('holds the Cloudflare secrets only after the install', () => {
        const release = job(workflow('ci.yml'), 'release');
        const install = release.indexOf('run: pnpm install');

        expect(install).toBeGreaterThan(-1);
        expect(release.slice(0, install)).not.toContain('secrets.');
        expect(release.slice(install)).toContain('secrets.CLOUDFLARE_API_TOKEN');
        expect(release.slice(install)).toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
    });

    it('leaves the check, which a pull request starts, without any secret', () => {
        expect(job(workflow('ci.yml'), 'check')).not.toContain('secrets.');
    });
});

describe('the tag job', () => {
    it('runs after the release, on a push, and is the only one that writes to the repository', () => {
        const text = workflow('ci.yml');
        const tag = job(text, 'tag');

        expect(tag).toContain('needs: [version, release]');
        expect(tag).toContain("if: github.event_name == 'push' && needs.version.outputs.new == 'true'");
        expect(tag).toContain('permissions:\n            contents: write\n');
        expect(tag).not.toContain('secrets.');
        expect(text.match(/contents: write/g)).toHaveLength(1);
        expect(text).toMatch(/\npermissions:\n {4}contents: read\n/);
    });

    it('creates the release of a version only when it does not exist yet', () => {
        const tag = job(workflow('ci.yml'), 'tag');

        expect(tag.indexOf('gh release view')).toBeGreaterThan(-1);
        expect(tag.indexOf('gh release create')).toBeGreaterThan(tag.indexOf('gh release view'));
        expect(tag).toContain('--target "$GITHUB_SHA"');
    });
});

describe('the storybook', () => {
    const storybook = () => {
        const { config, error } = ts.parseConfigFileTextToJson('wrangler.jsonc', read('design-system/wrangler.jsonc'));
        expect(error).toBeUndefined();
        return config as Record<string, unknown>;
    };

    it('is a Worker of static files only, on its own custom domain', () => {
        const config = storybook();

        expect(Object.keys(config).sort()).toEqual(
            ['$schema', 'assets', 'compatibility_date', 'name', 'routes', 'workers_dev'].sort()
        );
        expect(config.name).toBe('tarja-storybook');
        expect(config.workers_dev).toBe(false);
        expect(config.assets).toEqual({ directory: './storybook-static' });
        expect(config.routes).toEqual([{ pattern: 'tarja-storybook.albz.app', custom_domain: true }]);
    });

    it('is built and deployed with its own config', () => {
        expect(scripts()['deploy:storybook']).toBe(
            'pnpm --filter design-system build && wrangler deploy --config design-system/wrangler.jsonc'
        );
    });

    it('is deployed after a release only, and the tag never waits for it', () => {
        const text = workflow('ci.yml');
        const storybookJob = job(text, 'storybook');

        expect(storybookJob).toContain('needs: [version, release]');
        expect(storybookJob).toContain("if: github.event_name == 'push' && needs.version.outputs.new == 'true'");
        expect(storybookJob).toContain('run: pnpm deploy:storybook');
        expect(job(text, 'tag')).not.toContain('storybook');
        expect(job(text, 'check')).not.toContain('storybook');
        expect(workflow('prerelease.yml')).not.toContain('storybook');
    });

    it('holds the Cloudflare secrets only after the install', () => {
        const storybookJob = job(workflow('ci.yml'), 'storybook');
        const install = storybookJob.indexOf('run: pnpm install');

        expect(install).toBeGreaterThan(-1);
        expect(storybookJob.slice(0, install)).not.toContain('secrets.');
        expect(storybookJob.slice(install)).toContain('secrets.CLOUDFLARE_API_TOKEN');
        expect(storybookJob.slice(install)).toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
    });

    it('sends headers against framing by other sites and sniffing', () => {
        const headers = read('design-system/public/_headers');

        expect(headers).toMatch(/^\/\*\n/);
        expect(headers).toContain("Content-Security-Policy: frame-ancestors 'self'");
        expect(headers).toContain('X-Frame-Options: SAMEORIGIN');
        expect(headers).toContain('X-Content-Type-Options: nosniff');
        expect(headers).toContain('Referrer-Policy: strict-origin');
    });
});
