import { readDuration } from '@/lib/motion';

const THEMES = ['light', 'dark', 'system'] as const;

type Theme = (typeof THEMES)[number];

const DEFAULT_THEME: Theme = 'light';

const STORAGE_KEY = 'tarja:theme';

// How dark the dark theme is: a dark gray, or pure black for OLED screens (ADR-0047)
const DARK_TONES = ['standard', 'oled'] as const;

type DarkTone = (typeof DARK_TONES)[number];

const DEFAULT_DARK_TONE: DarkTone = 'standard';

const DARK_TONE_KEY = 'tarja:dark-tone';

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

const isDarkTone = (value: unknown): value is DarkTone => {
    return DARK_TONES.some((tone) => tone === value);
};

const readStoredDarkTone = (): DarkTone => {
    try {
        const stored = localStorage.getItem(DARK_TONE_KEY);
        return isDarkTone(stored) ? stored : DEFAULT_DARK_TONE;
    } catch {
        return DEFAULT_DARK_TONE;
    }
};

const storeDarkTone = (tone: DarkTone): void => {
    try {
        localStorage.setItem(DARK_TONE_KEY, tone);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
};

// The app color was a choice once (ADR-0027); what an older version stored is removed
const forgetStoredAccent = (): void => {
    try {
        localStorage.removeItem('tarja:accent');
    } catch {
        // Storage can be blocked; there is nothing to remove then
    }
};

// The look a theme gives: "system" is whichever the device prefers
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
    if (theme !== 'system') {
        return theme;
    }
    const prefersDark =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
};

// Light and dark force the color scheme; "system" leaves it to the OS. The tokens read it from the root.
const applyTheme = (theme: Theme): void => {
    document.documentElement.dataset.theme = theme;
};

// The tone is written whatever the theme, so "system" turning dark later already has it
const applyDarkTone = (tone: DarkTone): void => {
    document.documentElement.dataset.darkTone = tone;
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

// The static HTML carries one color per OS preference, the dark one with its OLED tone beside it; an explicit theme
// overrides both
const syncThemeColor = (theme: Theme, tone: DarkTone, readColor: () => string = readSurfaceColor): void => {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    const surface = theme === 'system' ? null : readColor();
    for (const meta of metas) {
        meta.dataset.default ??= meta.content;
        const preferred = tone === 'oled' ? (meta.dataset.oled ?? meta.dataset.default) : meta.dataset.default;
        meta.content = surface ?? preferred;
    }
};

export {
    DARK_TONES,
    DEFAULT_DARK_TONE,
    DEFAULT_THEME,
    THEMES,
    applyDarkTone,
    applyTheme,
    forgetStoredAccent,
    isDarkTone,
    isTheme,
    readStoredDarkTone,
    readStoredTheme,
    resolveTheme,
    revealTheme,
    storeDarkTone,
    storeTheme,
    syncThemeColor,
    withColorTransition,
    type DarkTone,
    type Theme,
};
