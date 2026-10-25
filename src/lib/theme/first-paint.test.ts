import { afterEach, describe, expect, it, vi } from 'vitest';

import html from '/index.html?raw';

const root = document.documentElement;

// What the browser runs in the head before it paints anything
function runFirstPaint() {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!script) throw new Error('index.html has no inline script');
    new Function(script)();
}

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-accent');
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
});
