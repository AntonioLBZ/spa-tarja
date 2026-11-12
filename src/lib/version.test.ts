import { afterEach, describe, expect, it, vi } from 'vitest';

import { appVersion } from './version';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('appVersion', () => {
    it('is the number of the release', () => {
        vi.stubEnv('VITE_APP_VERSION', '1.2.3');
        vi.stubEnv('VITE_APP_COMMIT', '');

        expect(appVersion()).toBe('1.2.3');
    });

    it('carries the commit as build metadata when the build has one', () => {
        vi.stubEnv('VITE_APP_VERSION', '1.2.3');
        vi.stubEnv('VITE_APP_COMMIT', 'abc1234');

        expect(appVersion()).toBe('1.2.3+abc1234');
    });

    it('reads dev where the build set nothing', () => {
        expect(appVersion()).toBe('dev');
    });

    it('reads dev, with no commit, when only the commit is set', () => {
        vi.stubEnv('VITE_APP_COMMIT', 'abc1234');

        expect(appVersion()).toBe('dev+abc1234');
    });
});
