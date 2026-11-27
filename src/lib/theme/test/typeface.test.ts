import { afterEach, describe, expect, it } from 'vitest';

import { applyTypeface, readStoredTypeface, storeTypeface } from '@/lib/theme/typeface';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-typeface');
});

describe('the typeface', () => {
    it('is monospace when nothing was saved or what was saved is not a typeface', () => {
        expect(readStoredTypeface()).toBe('mono');

        localStorage.setItem('tarja:typeface', 'serif');

        expect(readStoredTypeface()).toBe('mono');
    });

    it('reads back what was stored', () => {
        storeTypeface('legible');

        expect(readStoredTypeface()).toBe('legible');
    });

    it('marks the root for a chosen face and leaves it bare for monospace', () => {
        applyTypeface('sans');

        expect(root.dataset.typeface).toBe('sans');

        applyTypeface('mono');

        expect(root.hasAttribute('data-typeface')).toBe(false);
    });
});
