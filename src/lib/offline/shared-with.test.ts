import { beforeEach, describe, expect, it } from 'vitest';

import { forgetSharedWith, readSharedWith, rememberSharedWith } from './shared-with';

beforeEach(() => {
    localStorage.clear();
});

describe('the group last shared with', () => {
    it('is kept for each user apart from any other on the device', () => {
        rememberSharedWith('ana', 'group-of-ana');
        rememberSharedWith('bea', 'group-of-bea');

        expect(readSharedWith('ana')).toBe('group-of-ana');
        expect(readSharedWith('bea')).toBe('group-of-bea');
        expect(readSharedWith('cris')).toBeNull();
        expect(localStorage.getItem('tarja:shared-with:ana')).toBe('group-of-ana');
        expect(localStorage.getItem('tarja:shared-with')).toBeNull();
    });

    it('is forgotten for that user only', () => {
        rememberSharedWith('ana', 'group-of-ana');
        rememberSharedWith('bea', 'group-of-bea');

        forgetSharedWith('ana');

        expect(readSharedWith('ana')).toBeNull();
        expect(readSharedWith('bea')).toBe('group-of-bea');
    });

    it('never reads what was stored before it was kept by user', () => {
        localStorage.setItem('tarja:shared-with', 'old-group');

        expect(readSharedWith('ana')).toBeNull();
    });
});
