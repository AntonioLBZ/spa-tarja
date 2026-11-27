import tokensCss from '@/assets/styles/tokens.css?raw';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';

import { useFrameGlobals } from './frame-globals';
import { paletteOf } from './palette';
import { resolveTheme, storybookThemes } from './themes';

import type { ReactNode } from 'react';

import '@stories/shared/docs.css';

const THEMES = storybookThemes(paletteOf(tokensCss));

interface ThemedDocsContainerProps extends DocsContainerProps {
    children?: ReactNode;
}

// Storybook's docs container in the theme of the Theme toolbar, as the frame around it
const ThemedDocsContainer = (props: ThemedDocsContainerProps) => {
    const { context, children } = props;
    const { theme } = useFrameGlobals({});

    return (
        <DocsContainer context={context} theme={THEMES[resolveTheme(theme)]}>
            {children}
        </DocsContainer>
    );
};

export { ThemedDocsContainer };
