import { readDuration } from '@/lib/motion';

const THEMES = ['system', 'light', 'dark'] as const;

type Theme = (typeof THEMES)[number];

const DEFAULT_THEME: Theme = 'system';

const STORAGE_KEY = 'tarja:theme';

function isTheme(value: unknown): value is Theme {
    return THEMES.some((theme) => theme === value);
}

function readStoredTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isTheme(stored) ? stored : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

function storeTheme(theme: Theme): void {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
}

// An explicit theme forces the color scheme; "system" leaves it to the OS
function applyTheme(theme: Theme): void {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = theme;
}

let colorTransitionTimer: ReturnType<typeof setTimeout> | undefined;

// Marks the root for `--duration-slow` so the colors fade instead of snapping (see design.md)
function withColorTransition(update: () => void): void {
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
}

// The header surface, resolved for the current color scheme
function readSurfaceColor(): string {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--color-bg-secondary)';
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
}

// index.html carries one color per OS preference; an explicit theme overrides both
function syncThemeColor(theme: Theme, readColor: () => string = readSurfaceColor): void {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    const surface = theme === 'system' ? null : readColor();
    for (const meta of metas) {
        meta.dataset.default ??= meta.content;
        meta.content = surface ?? meta.dataset.default;
    }
}

export { DEFAULT_THEME, THEMES, applyTheme, isTheme, readStoredTheme, storeTheme, syncThemeColor, withColorTransition };
export type { Theme };
