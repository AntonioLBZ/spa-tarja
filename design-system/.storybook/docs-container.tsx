import tokensCss from '@/assets/styles/tokens.css?raw';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { useEffect, useState, type ReactNode } from 'react';
import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';

import { paletteOf } from './palette';
import { DARK_SCHEME, resolveTheme, storybookThemes } from './themes';

import '@stories/shared/docs.css';

const THEMES = storybookThemes(paletteOf(tokensCss));

interface GlobalsEvent {
    globals?: { theme?: unknown };
}

interface ThemedDocsContainerProps extends DocsContainerProps {
    children?: ReactNode;
}

// Storybook's docs container in the theme of the Theme toolbar, as the frame around it
const ThemedDocsContainer = (props: ThemedDocsContainerProps) => {
    const { context, children } = props;
    const { channel } = context;
    const lastTheme = () => {
        const [event] = (channel.last(GLOBALS_UPDATED) ?? channel.last(SET_GLOBALS) ?? []) as GlobalsEvent[];
        return event?.globals?.theme;
    };
    const [theme, setTheme] = useState<unknown>(lastTheme);
    const [, setSchemeChanges] = useState(0);

    useEffect(() => {
        const onGlobals = (event: GlobalsEvent) => setTheme(event.globals?.theme);
        const scheme = window.matchMedia(DARK_SCHEME);
        const onScheme = () => setSchemeChanges((count) => count + 1);
        channel.on(GLOBALS_UPDATED, onGlobals);
        channel.on(SET_GLOBALS, onGlobals);
        scheme.addEventListener('change', onScheme);
        return () => {
            channel.off(GLOBALS_UPDATED, onGlobals);
            channel.off(SET_GLOBALS, onGlobals);
            scheme.removeEventListener('change', onScheme);
        };
    }, [channel]);

    return (
        <DocsContainer context={context} theme={THEMES[resolveTheme(theme)]}>
            {children}
        </DocsContainer>
    );
};

export { ThemedDocsContainer };
