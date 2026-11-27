import { create, type ThemeVars } from 'storybook/theming';

import type { Mode, Palette } from './palette';

// The logo of the sidebar header, with the version of the app it was built from
const brandTitle = (version: string) => {
    const tagline = version ? `design system · v${version}` : 'design system';
    return `<span class="tarja-brand"><span class="tarja-brand__name">Tarja</span><span class="tarja-brand__tagline">${tagline}</span></span>`;
};

const GETTING_STARTED = '?path=/docs/getting-started--docs';

const themeFor = (palette: Palette, mode: Mode, version: string): ThemeVars => {
    const color = (name: string) => palette.colors[mode][`--color-${name}`] ?? '';

    return create({
        base: mode === 'light' ? 'light' : 'dark',
        brandTitle: brandTitle(version),
        brandUrl: GETTING_STARTED,
        brandTarget: '_self',
        fontBase: palette.font,
        fontCode: palette.font,
        colorPrimary: color('accent'),
        // The selected row of the sidebar is this color under white text, darkened in the dark theme
        colorSecondary: mode === 'light' ? color('accent') : color('content-secondary'),
        appBg: color('bg-secondary'),
        appContentBg: color('bg-primary'),
        appPreviewBg: color('bg-primary'),
        appHoverBg: color('border-subtle'),
        appBorderColor: color('border-subtle'),
        appBorderRadius: 0,
        textColor: color('content-primary'),
        textInverseColor: color('content-on-accent'),
        textMutedColor: color('content-secondary'),
        barTextColor: color('content-secondary'),
        barHoverColor: color('content-primary'),
        barSelectedColor: color('content-primary'),
        barBg: color('bg-secondary'),
        buttonBg: color('bg-primary'),
        buttonBorder: color('border-subtle'),
        booleanBg: color('bg-secondary'),
        booleanSelectedBg: color('bg-primary'),
        inputBg: color('bg-primary'),
        inputBorder: color('border-subtle'),
        inputTextColor: color('content-primary'),
        inputBorderRadius: 0,
    });
};

const storybookThemes = (palette: Palette, version = ''): Record<Mode, ThemeVars> => {
    return {
        light: themeFor(palette, 'light', version),
        dark: themeFor(palette, 'dark', version),
        black: themeFor(palette, 'black', version),
    };
};

// The choices of the Theme toolbar: the theme of the app and, for dark, its tone (ADR-0047). The app's System only
// picks one of these, so it has no choice of its own here
const APPEARANCES = {
    light: { theme: 'light', darkTone: 'standard', title: 'light' },
    dark: { theme: 'dark', darkTone: 'standard', title: 'dark' },
    'dark-black': { theme: 'dark', darkTone: 'black', title: 'dark · pure black' },
} as const;

type AppearanceKey = keyof typeof APPEARANCES;

const appearanceOf = (value: unknown) => {
    const key = Object.keys(APPEARANCES).find((name) => name === value) as AppearanceKey | undefined;
    return APPEARANCES[key ?? 'light'];
};

// The value of the Theme toolbar as the look painted
const resolveTheme = (value: unknown): Mode => {
    const { theme, darkTone } = appearanceOf(value);
    if (theme === 'light') return 'light';
    return darkTone === 'black' ? 'black' : 'dark';
};

export { APPEARANCES, appearanceOf, resolveTheme, storybookThemes, type AppearanceKey };
