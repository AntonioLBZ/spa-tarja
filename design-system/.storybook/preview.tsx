import { ACCENTS, AccentProvider, type Accent } from '@/lib/accent';
import { storeAccent } from '@/lib/accent/accent';
import { LOCALES, LOCALE_NAMES, LocaleProvider, type AppLocale } from '@/lib/i18n';
import { storeLocale } from '@/lib/i18n/locale';
import { THEMES, ThemeProvider, type Theme } from '@/lib/theme';
import { storeTheme } from '@/lib/theme/theme';

import type { Preview } from '@storybook/react-vite';

import '@/assets/styles/main.css';

// The widths where the layout changes: the narrowest phone, a common one, and the two breakpoints
const VIEWPORTS = {
    narrow: { name: '320 px', styles: { width: '320px', height: '640px' }, type: 'mobile' },
    phone: { name: '390 px', styles: { width: '390px', height: '844px' }, type: 'mobile' },
    tablet: { name: '640 px (40rem)', styles: { width: '640px', height: '900px' }, type: 'tablet' },
    desktop: { name: '1024 px (64rem)', styles: { width: '1024px', height: '768px' }, type: 'desktop' },
} as const;

const preview: Preview = {
    decorators: [
        (Story, context) => {
            const theme = context.globals.theme as Theme;
            const accent = context.globals.accent as Accent;
            const locale = context.globals.locale as AppLocale;
            // The providers start from the stored choice, so a change in the toolbar is stored and they start again
            storeTheme(theme);
            storeAccent(accent);
            storeLocale(locale);

            return (
                <LocaleProvider key={`${theme}-${accent}-${locale}`}>
                    <ThemeProvider>
                        <AccentProvider>
                            <Story />
                        </AccentProvider>
                    </ThemeProvider>
                </LocaleProvider>
            );
        },
    ],
    globalTypes: {
        theme: {
            description: 'Theme',
            toolbar: { title: 'Theme', icon: 'contrast', items: [...THEMES], dynamicTitle: true },
        },
        accent: {
            description: 'Accent',
            toolbar: { title: 'Accent', icon: 'paintbrush', items: [...ACCENTS], dynamicTitle: true },
        },
        locale: {
            description: 'Language',
            toolbar: {
                title: 'Language',
                icon: 'globe',
                items: LOCALES.map((locale) => ({ value: locale, title: LOCALE_NAMES[locale] })),
                dynamicTitle: true,
            },
        },
    },
    initialGlobals: { theme: 'light', accent: 'gray', locale: 'en' },
    parameters: {
        backgrounds: { disabled: true },
        viewport: { options: VIEWPORTS },
    },
};

export default preview;
