import { useFocusSource } from '@/lib/a11y';
import { AmountsProvider } from '@/lib/amounts';
import { DEFAULT_AMOUNT_PREFERENCES, storeAmounts } from '@/lib/amounts/amounts';
import { LOCALES, LOCALE_NAMES, LocaleProvider, type AppLocale } from '@/lib/i18n';
import { storeLocale } from '@/lib/i18n/locale';
import { THEMES, ThemeProvider, type Theme } from '@/lib/theme';
import { storeTheme } from '@/lib/theme/theme';

import type { Preview } from '@storybook/react-vite';
import type { ReactNode } from 'react';

import '@/assets/styles/main.css';

// The widths where the layout changes: the narrowest phone, a common one, and the two breakpoints
const VIEWPORTS = {
    narrow: { name: '320 px', styles: { width: '320px', height: '640px' }, type: 'mobile' },
    phone: { name: '390 px', styles: { width: '390px', height: '844px' }, type: 'mobile' },
    tablet: { name: '640 px (40rem)', styles: { width: '640px', height: '900px' }, type: 'tablet' },
    desktop: { name: '1024 px (64rem)', styles: { width: '1024px', height: '768px' }, type: 'desktop' },
} as const;

// The settings of amounts a story can be seen with (ADR-0028)
const AMOUNT_CUES = {
    'all cues': {},
    'color off': { color: false },
    'color blindness': { colorBlind: true },
    'no cues': { color: false, sign: false, arrows: false },
} as const;

interface FocusSourceProps {
    children: ReactNode;
}

// Tells the fields how the focus last moved, as the app does around its pages
const FocusSource = (props: FocusSourceProps) => {
    const { children } = props;
    useFocusSource();

    return children;
};

const preview: Preview = {
    decorators: [
        (Story, context) => {
            const theme = context.globals.theme as Theme;
            const locale = context.globals.locale as AppLocale;
            const cues = context.globals.amounts as keyof typeof AMOUNT_CUES;
            // The providers start from the stored choice, so a change in the toolbar is stored and they start again
            storeTheme(theme);
            storeLocale(locale);
            storeAmounts({ ...DEFAULT_AMOUNT_PREFERENCES, ...AMOUNT_CUES[cues] });

            return (
                <LocaleProvider key={`${theme}-${locale}-${cues}`}>
                    <ThemeProvider>
                        <AmountsProvider>
                            <FocusSource>
                                <Story />
                            </FocusSource>
                        </AmountsProvider>
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
        amounts: {
            description: 'How amounts show which way they go',
            toolbar: { title: 'Amounts', icon: 'transfer', items: Object.keys(AMOUNT_CUES), dynamicTitle: true },
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
    initialGlobals: { theme: 'light', locale: 'en', amounts: 'all cues' },
    parameters: {
        backgrounds: { disabled: true },
        viewport: { options: VIEWPORTS },
    },
};

export default preview;
