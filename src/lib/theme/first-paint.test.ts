import { afterEach, describe, expect, it, vi } from 'vitest';

import { syncThemeColor } from './theme';

import html from '/index.html?raw';

const root = document.documentElement;

// What the browser runs in the head before it paints anything
function runFirstPaint() {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!script) throw new Error('index.html has no inline script');
    new Function(script)();
}

function addToolbarColors() {
    document.head.innerHTML = html.match(/<meta name="theme-color"[^>]*>/g)?.join('') ?? '';
    return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
}

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-accent');
    document.head.innerHTML = '';
    vi.restoreAllMocks();
});

describe('the script that runs before the first paint', () => {
    it('leaves the root bare when nothing was saved, which is the light theme and the gray accent', () => {
        runFirstPaint();

        expect(root.hasAttribute('data-theme')).toBe(false);
        expect(root.hasAttribute('data-accent')).toBe(false);
    });

    it.each(['dark', 'system'])('puts a saved %s theme on the root', (theme) => {
        localStorage.setItem('tarja:theme', theme);

        runFirstPaint();

        expect(root.dataset.theme).toBe(theme);
    });

    it('puts a saved accent on the root', () => {
        localStorage.setItem('tarja:accent', 'violet');

        runFirstPaint();

        expect(root.dataset.accent).toBe('violet');
    });

    it('does not let a value that is not a theme or an accent through', () => {
        localStorage.setItem('tarja:theme', 'sepia');
        localStorage.setItem('tarja:accent', 'red');

        runFirstPaint();

        expect(root.hasAttribute('data-theme')).toBe(false);
        expect(root.hasAttribute('data-accent')).toBe(false);
    });

    it('does nothing when the storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(runFirstPaint).not.toThrow();
        expect(root.hasAttribute('data-theme')).toBe(false);
    });

    it('keeps the toolbar colors of index.html ahead of the script that reads them', () => {
        expect(html.indexOf('name="theme-color"')).toBeGreaterThan(-1);
        expect(html.indexOf('name="theme-color"')).toBeLessThan(html.indexOf('<script>'));
    });

    it('points every toolbar color at the light header surface when nothing was saved', () => {
        const metas = addToolbarColors();

        runFirstPaint();

        expect(metas.map((meta) => meta.content)).toEqual(['#f4f4f4', '#f4f4f4']);
    });

    it('points every toolbar color at the dark header surface for a saved dark theme', () => {
        localStorage.setItem('tarja:theme', 'dark');
        const metas = addToolbarColors();

        runFirstPaint();

        expect(metas.map((meta) => meta.content)).toEqual(['#141414', '#141414']);
    });

    it('leaves one toolbar color per OS preference for the system theme', () => {
        localStorage.setItem('tarja:theme', 'system');
        const metas = addToolbarColors();

        runFirstPaint();

        expect(metas.map((meta) => meta.content)).toEqual(['#f4f4f4', '#141414']);
    });

    it('points the toolbar at the light header surface when the storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const metas = addToolbarColors();

        runFirstPaint();

        expect(metas.map((meta) => meta.content)).toEqual(['#f4f4f4', '#f4f4f4']);
    });

    it('lets the app put the per-preference colors back on a switch to the system theme', () => {
        const metas = addToolbarColors();
        runFirstPaint();

        syncThemeColor('system');

        expect(metas.map((meta) => meta.content)).toEqual(['#f4f4f4', '#141414']);
    });
});
