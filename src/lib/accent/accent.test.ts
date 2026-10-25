import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCENTS, DEFAULT_ACCENT, applyAccent, isAccent, readStoredAccent, storeAccent } from './accent';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-accent');
    vi.restoreAllMocks();
});

describe('accents', () => {
    it('are the fixed list of design.md, the default first', () => {
        expect(ACCENTS).toEqual(['gray', 'amber', 'blue', 'green', 'violet', 'pink']);
        expect(DEFAULT_ACCENT).toBe('gray');
    });

    it('are the only values isAccent accepts', () => {
        expect(ACCENTS.every(isAccent)).toBe(true);
        expect(isAccent('red')).toBe(false);
        expect(isAccent(null)).toBe(false);
    });
});

describe('stored accent', () => {
    it('defaults to gray', () => {
        expect(readStoredAccent()).toBe('gray');
    });

    it('reads back what was stored', () => {
        storeAccent('violet');

        expect(readStoredAccent()).toBe('violet');
        expect(localStorage.getItem('tarja:accent')).toBe('violet');
    });

    it('ignores a stored value that is not an accent', () => {
        localStorage.setItem('tarja:accent', 'red');

        expect(readStoredAccent()).toBe('gray');
    });

    it('survives storage being blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(readStoredAccent()).toBe('gray');
        expect(() => storeAccent('blue')).not.toThrow();
    });
});

describe('applyAccent', () => {
    it('picks the preset through data-accent on the root', () => {
        applyAccent('green');

        expect(root.dataset.accent).toBe('green');
    });

    it('leaves the root bare for gray, which is what the tokens start with', () => {
        applyAccent('green');

        applyAccent('gray');

        expect(root.hasAttribute('data-accent')).toBe(false);
    });
});
