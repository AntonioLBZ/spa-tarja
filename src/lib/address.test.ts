import { describe, expect, it } from 'vitest';

import { NEW_ADDRESS, NEW_HOST, isOldAddress } from './address';

describe('isOldAddress', () => {
    it('is the workers.dev address the app left', () => {
        expect(isOldAddress('tarja.antoniolbz.workers.dev')).toBe(true);
    });

    it.each([
        'tarja.albz.app',
        'localhost',
        '127.0.0.1',
        'other.antoniolbz.workers.dev',
        'tarja.antoniolbz.workers.dev.example.com',
        '',
    ])('is not %j', (hostname) => {
        expect(isOldAddress(hostname)).toBe(false);
    });
});

describe('the new address', () => {
    it('is the production domain, over https', () => {
        expect(NEW_HOST).toBe('tarja.albz.app');
        expect(NEW_ADDRESS).toBe('https://tarja.albz.app');
    });
});
