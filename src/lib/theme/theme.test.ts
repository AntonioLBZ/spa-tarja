import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    DEFAULT_THEME,
    applyTheme,
    isTheme,
    readStoredTheme,
    storeTheme,
    syncThemeColor,
    withColorTransition,
} from './theme';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-color-transition');
    root.style.removeProperty('--duration-slow');
    document.head.innerHTML = '';
    vi.useRealTimers();
});

describe('isTheme', () => {
    it('knows the three themes only', () => {
        expect(['system', 'light', 'dark'].every(isTheme)).toBe(true);
        expect(isTheme('sepia')).toBe(false);
        expect(isTheme(null)).toBe(false);
    });
});

describe('stored theme', () => {
    it('defaults to the light theme', () => {
        expect(DEFAULT_THEME).toBe('light');
        expect(readStoredTheme()).toBe('light');
    });

    it('reads back what was stored', () => {
        storeTheme('dark');

        expect(readStoredTheme()).toBe('dark');
    });

    it('ignores a stored value that is not a theme', () => {
        localStorage.setItem('tarja:theme', 'sepia');

        expect(readStoredTheme()).toBe('light');
    });

    it('survives storage being blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(readStoredTheme()).toBe('light');
        expect(() => storeTheme('dark')).not.toThrow();

        vi.restoreAllMocks();
    });
});

describe('applyTheme', () => {
    it('writes the theme on the root, whichever it is', () => {
        applyTheme('dark');
        expect(root.dataset.theme).toBe('dark');

        applyTheme('light');
        expect(root.dataset.theme).toBe('light');

        applyTheme('system');
        expect(root.dataset.theme).toBe('system');
    });
});

describe('withColorTransition', () => {
    it('marks the root while the colors fade and clears it afterwards', () => {
        vi.useFakeTimers();
        root.style.setProperty('--duration-slow', '360ms');
        const update = vi.fn();

        withColorTransition(update);

        expect(update).toHaveBeenCalledOnce();
        expect(root.hasAttribute('data-color-transition')).toBe(true);
        vi.advanceTimersByTime(359);
        expect(root.hasAttribute('data-color-transition')).toBe(true);
        vi.advanceTimersByTime(1);
        expect(root.hasAttribute('data-color-transition')).toBe(false);
    });

    it('just updates when there is no fade, as with reduced motion', () => {
        root.style.setProperty('--duration-slow', '0ms');
        const update = vi.fn();

        withColorTransition(update);

        expect(update).toHaveBeenCalledOnce();
        expect(root.hasAttribute('data-color-transition')).toBe(false);
    });

    it('keeps the mark for the full time when called again mid-fade', () => {
        vi.useFakeTimers();
        root.style.setProperty('--duration-slow', '360ms');

        withColorTransition(() => undefined);
        vi.advanceTimersByTime(300);
        withColorTransition(() => undefined);
        vi.advanceTimersByTime(300);

        expect(root.hasAttribute('data-color-transition')).toBe(true);
        vi.advanceTimersByTime(60);
        expect(root.hasAttribute('data-color-transition')).toBe(false);
    });
});

describe('syncThemeColor', () => {
    function addMetas() {
        document.head.innerHTML =
            '<meta name="theme-color" content="#light" media="(prefers-color-scheme: light)">' +
            '<meta name="theme-color" content="#dark" media="(prefers-color-scheme: dark)">';
        return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    }

    it('points every toolbar color at the header surface for an explicit theme', () => {
        const metas = addMetas();

        syncThemeColor('dark', () => 'rgb(20, 20, 20)');

        expect(metas.map((meta) => meta.content)).toEqual(['rgb(20, 20, 20)', 'rgb(20, 20, 20)']);
    });

    it('puts the per-preference colors back for the system theme', () => {
        const metas = addMetas();
        syncThemeColor('dark', () => 'rgb(20, 20, 20)');

        syncThemeColor('system', () => 'unused');

        expect(metas.map((meta) => meta.content)).toEqual(['#light', '#dark']);
    });
});
