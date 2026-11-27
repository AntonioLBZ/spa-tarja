import tokensCss from '@/assets/styles/tokens.css?raw';
import { applyDarkTone, applyTheme } from '@/lib/theme/theme';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

import { useFrameGlobals } from './frame-globals';
import { paletteOf } from './palette';
import { DARK_SCHEME, appearanceOf, resolveTheme, storybookThemes } from './themes';

import '@stories/shared/docs.css';

const THEMES = storybookThemes(paletteOf(tokensCss));

interface ThemedDocsContainerProps extends DocsContainerProps {
    children?: ReactNode;
}

// Storybook's docs container in the theme of the Theme toolbar, as the frame around it
const ThemedDocsContainer = (props: ThemedDocsContainerProps) => {
    const { context, children } = props;
    const { theme } = useFrameGlobals({});
    const [, setSchemeChanges] = useState(0);

    // On the page too, so that the stories it shows in iframes of their own see the same color scheme
    useLayoutEffect(() => {
        const appearance = appearanceOf(theme);
        applyTheme(appearance.theme);
        applyDarkTone(appearance.darkTone);
    }, [theme]);

    useEffect(() => {
        const scheme = window.matchMedia(DARK_SCHEME);
        const onScheme = () => setSchemeChanges((count) => count + 1);
        scheme.addEventListener('change', onScheme);
        return () => scheme.removeEventListener('change', onScheme);
    }, []);

    return (
        <DocsContainer context={context} theme={THEMES[resolveTheme(theme)]}>
            {children}
        </DocsContainer>
    );
};

export { ThemedDocsContainer };
