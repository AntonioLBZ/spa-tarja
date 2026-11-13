import { readDuration } from '@/lib/motion';

const THEMES = ['light', 'dark', 'system'] as const;

type Theme = (typeof THEMES)[number];

const DEFAULT_THEME: Theme = 'light';

const STORAGE_KEY = 'tarja:theme';

const isTheme = (value: unknown): value is Theme => {
    return THEMES.some((theme) => theme === value);
};

const readStoredTheme = (): Theme => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isTheme(stored) ? stored : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
};

const storeTheme = (theme: Theme): void => {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
};

// Light and dark force the color scheme; "system" leaves it to the OS. The tokens read it from the root.
const applyTheme = (theme: Theme): void => {
    document.documentElement.dataset.theme = theme;
};

let colorTransitionTimer: ReturnType<typeof setTimeout> | undefined;

// Marks the root for `--duration-slow` so the colors fade instead of snapping
const withColorTransition = (update: () => void): void => {
    const duration = readDuration('--duration-slow');
    if (duration === 0) {
        update();
        return;
    }
    const root = document.documentElement;
    clearTimeout(colorTransitionTimer);
    root.dataset.colorTransition = '';
    update();
    colorTransitionTimer = setTimeout(() => root.removeAttribute('data-color-transition'), duration);
};

let revealing: ViewTransition | undefined;

// Where the last press landed: the ink starts there when the change comes from a tap or a click
let lastPress: { x: number; y: number; at: number } | undefined;

if (typeof document !== 'undefined') {
    document.addEventListener(
        'pointerdown',
        (event) => {
            lastPress = { x: event.clientX, y: event.clientY, at: Date.now() };
        },
        { capture: true, passive: true }
    );
}

const PRESS_MEMORY_MS = 1500;

// A change from the keyboard has no press to start at, so the ink comes from the top right corner
const revealOrigin = (): { x: number; y: number } => {
    if (lastPress && Date.now() - lastPress.at < PRESS_MEMORY_MS) {
        return { x: lastPress.x, y: lastPress.y };
    }
    return { x: window.innerWidth, y: 0 };
};

// When the last reveal started, in ms: each one takes two pictures of the whole screen, so they are never started
// back to back
let lastRevealAt = Number.NEGATIVE_INFINITY;

// While a view transition runs the browser gives the live page no pointer events. A tap ends the reveal at once and
// is then repeated on what is under it, so nothing waits for the ink.
const endRevealOnTap = (transition: ViewTransition): void => {
    const onPointerUp = (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }
        cleanup();
        transition.skipTransition();
        const { clientX, clientY } = event;
        const repeat = () => {
            document.elementFromPoint(clientX, clientY)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        };
        transition.finished.then(repeat, repeat);
    };
    const cleanup = () => document.removeEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointerup', onPointerUp, true);
    transition.finished.then(cleanup, cleanup);
};

// The new theme drifts in like ink from where the person pressed (ADR-0022). Where the browser can't, or with reduced
// motion, the colors fade instead, and so they do when a change comes before the last ink has had its time: it ends
// the running one at once.
const revealTheme = (update: () => void): void => {
    const duration = readDuration('--duration-reveal');
    const tooSoon = Date.now() - lastRevealAt < duration;
    if (duration === 0 || tooSoon || typeof document.startViewTransition !== 'function') {
        revealing?.skipTransition();
        withColorTransition(update);
        return;
    }
    lastRevealAt = Date.now();
    const root = document.documentElement;
    const easing = getComputedStyle(root).getPropertyValue('--ease-standard').trim();
    revealing?.skipTransition();
    const origin = revealOrigin();
    const reach = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y)
    );
    root.style.setProperty('--theme-x', `${origin.x}px`);
    root.style.setProperty('--theme-y', `${origin.y}px`);
    root.style.setProperty('--theme-reach', `${reach}px`);
    root.dataset.themeReveal = '';
    const transition = document.startViewTransition(update);
    revealing = transition;
    endRevealOnTap(transition);
    transition.ready
        .then(() => {
            root.animate(
                { '--theme-progress': [0, 1] },
                { duration, easing, fill: 'forwards', pseudoElement: '::view-transition-new(root)' }
            );
        })
        .catch(() => undefined);
    const clear = () => {
        if (revealing !== transition) {
            return;
        }
        revealing = undefined;
        root.removeAttribute('data-theme-reveal');
        for (const name of ['--theme-x', '--theme-y', '--theme-reach']) {
            root.style.removeProperty(name);
        }
    };
    transition.finished.then(clear, clear);
};

// The header surface, resolved for the current color scheme
const readSurfaceColor = (): string => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--color-bg-secondary)';
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
};

// The static HTML carries one color per OS preference; an explicit theme overrides both
const syncThemeColor = (theme: Theme, readColor: () => string = readSurfaceColor): void => {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    const surface = theme === 'system' ? null : readColor();
    for (const meta of metas) {
        meta.dataset.default ??= meta.content;
        meta.content = surface ?? meta.dataset.default;
    }
};

export {
    DEFAULT_THEME,
    THEMES,
    applyTheme,
    isTheme,
    readStoredTheme,
    revealTheme,
    storeTheme,
    syncThemeColor,
    withColorTransition,
    type Theme,
};
