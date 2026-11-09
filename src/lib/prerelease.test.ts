import { afterEach, describe, expect, it, vi } from 'vitest';

import { isPrerelease } from './prerelease';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('isPrerelease', () => {
    it('is true only when the build says prerelease', () => {
        vi.stubEnv('VITE_PRERELEASE', 'true');
        expect(isPrerelease()).toBe(true);

        vi.stubEnv('VITE_PRERELEASE', 'false');
        expect(isPrerelease()).toBe(false);

        vi.unstubAllEnvs();
        expect(isPrerelease()).toBe(false);
    });
});
