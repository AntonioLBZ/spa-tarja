import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    DEFAULT_THEME,
    applyTheme,
    isTheme,
    readStoredTheme,
    storeTheme,
    syncThemeColor,
    revealTheme,
    withColorTransition,
} from './theme';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-color-transition');
    root.removeAttribute('data-theme-reveal');
    root.style.removeProperty('--duration-slow');
    root.style.removeProperty('--duration-reveal');
    document.head.innerHTML = '';
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(root, 'animate');
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

describe('revealTheme', () => {
    let clock = 1_000_000;

    beforeEach(() => {
        clock += 60_000;
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(clock);
    });

    const stubViewTransition = () => {
        let finish: () => void = () => undefined;
        const finished = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const startViewTransition = vi.fn((callback: () => void) => {
            callback();
            return { ready: Promise.resolve(), finished, skipTransition: vi.fn() };
        });
        const animate = vi.fn();
        Object.assign(document, { startViewTransition });
        Object.assign(root, { animate });
        return { startViewTransition, animate, finish };
    };

    it('reveals the update as ink from the press, then cleans up', async () => {
        root.style.setProperty('--duration-reveal', '1080ms');
        const { startViewTransition, animate, finish } = stubViewTransition();
        const update = vi.fn(() => expect(root.hasAttribute('data-theme-reveal')).toBe(true));
        document.dispatchEvent(new PointerEvent('pointerdown', { clientX: 120, clientY: 340 }));

        revealTheme(update);

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledOnce();
        expect(root.style.getPropertyValue('--theme-x')).toBe('120px');
        expect(root.style.getPropertyValue('--theme-y')).toBe('340px');
        await vi.waitFor(() => expect(animate).toHaveBeenCalledOnce());
        expect(animate).toHaveBeenCalledWith(
            { '--theme-progress': [0, 1] },
            expect.objectContaining({ duration: 1080, pseudoElement: '::view-transition-new(root)' })
        );
        expect(root.hasAttribute('data-color-transition')).toBe(false);

        finish();
        await vi.waitFor(() => expect(root.hasAttribute('data-theme-reveal')).toBe(false));
        expect(root.style.getPropertyValue('--theme-x')).toBe('');
    });

    it('ends a running reveal when another change comes at once, and fades that change instead', async () => {
        root.style.setProperty('--duration-reveal', '1080ms');
        root.style.setProperty('--duration-slow', '360ms');
        let finish: () => void = () => undefined;
        const skipTransition = vi.fn();
        const startViewTransition = vi.fn((callback: () => void) => {
            callback();
            const finished = new Promise<void>((resolve) => {
                finish = resolve;
            });
            return { ready: Promise.resolve(), finished, skipTransition };
        });
        Object.assign(document, { startViewTransition });
        Object.assign(root, { animate: vi.fn() });
        const second = vi.fn();

        revealTheme(() => undefined);
        vi.setSystemTime(clock + 100);
        revealTheme(second);

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(skipTransition).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
        finish();
        await vi.waitFor(() => expect(root.hasAttribute('data-theme-reveal')).toBe(false));
    });

    it('starts from the top right corner when no press came just before', () => {
        root.style.setProperty('--duration-reveal', '1080ms');
        stubViewTransition();
        document.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
        vi.setSystemTime(clock + 5000);

        revealTheme(() => undefined);

        expect(root.style.getPropertyValue('--theme-x')).toBe(`${window.innerWidth}px`);
        expect(root.style.getPropertyValue('--theme-y')).toBe('0px');
    });

    it('starts a new reveal once the last one has had its time', () => {
        root.style.setProperty('--duration-reveal', '1080ms');
        const { startViewTransition } = stubViewTransition();

        revealTheme(() => undefined);
        vi.setSystemTime(clock + 1081);
        revealTheme(() => undefined);

        expect(startViewTransition).toHaveBeenCalledTimes(2);
    });

    it('ends the reveal on a tap and repeats the tap on the page under it', async () => {
        root.style.setProperty('--duration-reveal', '1080ms');
        let finish: () => void = () => undefined;
        const skipTransition = vi.fn(() => finish());
        Object.assign(document, {
            startViewTransition: vi.fn((callback: () => void) => {
                callback();
                const finished = new Promise<void>((resolve) => {
                    finish = resolve;
                });
                return { ready: Promise.resolve(), finished, skipTransition };
            }),
        });
        Object.assign(root, { animate: vi.fn() });
        const button = document.createElement('button');
        const onClick = vi.fn();
        button.addEventListener('click', onClick);
        root.appendChild(button);
        Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => button });

        revealTheme(() => undefined);
        document.dispatchEvent(new PointerEvent('pointerup', { isPrimary: true, button: 0, clientX: 5, clientY: 6 }));

        expect(skipTransition).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(onClick).toHaveBeenCalledOnce());
        button.remove();
        Reflect.deleteProperty(document, 'elementFromPoint');
    });

    it('fades the colors where the browser has no view transitions', () => {
        root.style.setProperty('--duration-reveal', '1080ms');
        root.style.setProperty('--duration-slow', '360ms');
        const update = vi.fn();

        revealTheme(update);

        expect(update).toHaveBeenCalledOnce();
        expect(root.hasAttribute('data-theme-reveal')).toBe(false);
        expect(root.hasAttribute('data-color-transition')).toBe(true);
    });

    it('just updates with reduced motion, even where view transitions exist', () => {
        root.style.setProperty('--duration-reveal', '0ms');
        root.style.setProperty('--duration-slow', '0ms');
        const { startViewTransition } = stubViewTransition();
        const update = vi.fn();

        revealTheme(update);

        expect(update).toHaveBeenCalledOnce();
        expect(startViewTransition).not.toHaveBeenCalled();
        expect(root.hasAttribute('data-theme-reveal')).toBe(false);
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
