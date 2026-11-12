import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCENTS, DEFAULT_ACCENT, applyAccent, isAccent, readStoredAccent, storeAccent } from './accent';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-accent');
    vi.restoreAllMocks();
});

describe('accents', () => {
    it('are a fixed list, the default first', () => {
        expect(ACCENTS).toEqual(['tangerine', 'cobalt', 'pine', 'grape', 'rose', 'ink']);
        expect(DEFAULT_ACCENT).toBe('tangerine');
    });

    it('are the only values isAccent accepts', () => {
        expect(ACCENTS.every(isAccent)).toBe(true);
        expect(isAccent('red')).toBe(false);
        expect(isAccent(null)).toBe(false);
    });
});

describe('stored accent', () => {
    it('defaults to tangerine', () => {
        expect(readStoredAccent()).toBe('tangerine');
    });

    it('reads back what was stored', () => {
        storeAccent('grape');

        expect(readStoredAccent()).toBe('grape');
        expect(localStorage.getItem('tarja:accent')).toBe('grape');
    });

    it('ignores a stored value that is not an accent', () => {
        localStorage.setItem('tarja:accent', 'red');

        expect(readStoredAccent()).toBe('tangerine');
    });

    it('survives storage being blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(readStoredAccent()).toBe('tangerine');
        expect(() => storeAccent('cobalt')).not.toThrow();
    });
});

describe('applyAccent', () => {
    it('picks the preset through data-accent on the root', () => {
        applyAccent('pine');

        expect(root.dataset.accent).toBe('pine');
    });

    it('leaves the root bare for tangerine, which is what the tokens start with', () => {
        applyAccent('pine');

        applyAccent('tangerine');

        expect(root.hasAttribute('data-accent')).toBe(false);
    });
});
