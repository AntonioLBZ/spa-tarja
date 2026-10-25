import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCENTS, DEFAULT_ACCENT, applyAccent, isAccent, readStoredAccent, storeAccent } from './accent';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-accent');
    vi.restoreAllMocks();
});

describe('accents', () => {
    it('are the fixed list of design.md, amber first', () => {
        expect(ACCENTS).toEqual(['amber', 'blue', 'green', 'violet', 'pink', 'gray']);
        expect(DEFAULT_ACCENT).toBe('amber');
    });

    it('are the only values isAccent accepts', () => {
        expect(ACCENTS.every(isAccent)).toBe(true);
        expect(isAccent('red')).toBe(false);
        expect(isAccent(null)).toBe(false);
    });
});

describe('stored accent', () => {
    it('defaults to amber', () => {
        expect(readStoredAccent()).toBe('amber');
    });

    it('reads back what was stored', () => {
        storeAccent('violet');

        expect(readStoredAccent()).toBe('violet');
        expect(localStorage.getItem('tarja:accent')).toBe('violet');
    });

    it('ignores a stored value that is not an accent', () => {
        localStorage.setItem('tarja:accent', 'red');

        expect(readStoredAccent()).toBe('amber');
    });

    it('survives storage being blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(readStoredAccent()).toBe('amber');
        expect(() => storeAccent('blue')).not.toThrow();
    });
});

describe('applyAccent', () => {
    it('picks the preset through data-accent on the root', () => {
        applyAccent('green');

        expect(root.dataset.accent).toBe('green');
    });

    it('leaves the root bare for amber, which is what the tokens start with', () => {
        applyAccent('green');

        applyAccent('amber');

        expect(root.hasAttribute('data-accent')).toBe(false);
    });
});
