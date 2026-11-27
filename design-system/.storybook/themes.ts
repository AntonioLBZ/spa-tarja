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
        base: mode,
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
    return { light: themeFor(palette, 'light', version), dark: themeFor(palette, 'dark', version) };
};

const DARK_SCHEME = '(prefers-color-scheme: dark)';

// The value of the Theme toolbar as the theme painted: `system` follows the device
const resolveTheme = (theme: unknown): Mode => {
    if (theme === 'dark') return 'dark';
    if (theme === 'system' && window.matchMedia(DARK_SCHEME).matches) return 'dark';
    return 'light';
};

export { DARK_SCHEME, resolveTheme, storybookThemes };
