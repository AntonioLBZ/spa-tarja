import { useFocusSource } from '@/lib/a11y';
import { AmountsProvider } from '@/lib/amounts';
import { DEFAULT_AMOUNT_PREFERENCES, storeAmounts } from '@/lib/amounts/amounts';
import { LOCALES, LOCALE_NAMES, LocaleProvider, type AppLocale } from '@/lib/i18n';
import { storeLocale } from '@/lib/i18n/locale';
import { DARK_TONES, THEMES, ThemeProvider, type DarkTone, type Theme } from '@/lib/theme';
import { storeDarkTone, storeTheme } from '@/lib/theme/theme';

import { ThemedDocsContainer } from './docs-container';

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
            const darkTone = context.globals.darkTone as DarkTone;
            const locale = context.globals.locale as AppLocale;
            const cues = context.globals.amounts as keyof typeof AMOUNT_CUES;
            // The providers start from the stored choice, so a change in the toolbar is stored and they start again
            storeTheme(theme);
            storeDarkTone(darkTone);
            storeLocale(locale);
            storeAmounts({ ...DEFAULT_AMOUNT_PREFERENCES, ...AMOUNT_CUES[cues] });

            return (
                <LocaleProvider key={`${theme}-${darkTone}-${locale}-${cues}`}>
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
        darkTone: {
            description: 'How dark the dark theme is',
            toolbar: { title: 'Dark tone', icon: 'circle', items: [...DARK_TONES], dynamicTitle: true },
        },
        // Only the features read these two: a component takes its copy and its cues by props, and a foundation neither
        amounts: {
            description: 'How the amounts of the features show which way they go; components take their cues by props',
            toolbar: {
                title: 'Amounts',
                icon: 'transfer',
                items: Object.keys(AMOUNT_CUES).map((cues) => ({ value: cues, title: `features: ${cues}` })),
                dynamicTitle: true,
            },
        },
        locale: {
            description: 'Language of the features; components take their copy by props',
            toolbar: {
                title: 'Language',
                icon: 'globe',
                items: LOCALES.map((locale) => ({ value: locale, title: `features: ${LOCALE_NAMES[locale]}` })),
                dynamicTitle: true,
            },
        },
    },
    initialGlobals: { theme: 'light', darkTone: 'standard', locale: 'en', amounts: 'all cues' },
    parameters: {
        backgrounds: { disabled: true },
        docs: { container: ThemedDocsContainer },
        options: {
            storySort: {
                order: [
                    'Getting started',
                    'Foundations',
                    ['Colors', 'Typography', 'Iconography', 'Spacing', 'Motion'],
                    'Components',
                    'Features',
                ],
            },
        },
        viewport: { options: VIEWPORTS },
    },
};

export default preview;
