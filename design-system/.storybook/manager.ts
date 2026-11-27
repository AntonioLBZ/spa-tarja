import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';
import { addons } from 'storybook/manager-api';

import { paletteOf } from './palette';
import { DARK_SCHEME, resolveTheme, storybookThemes } from './themes';

// The tokens and the version of the app, written into the head of the frame when it is built
declare global {
    var TARJA_TOKENS_CSS: string;
    var TARJA_VERSION: string;
}

const THEMES = storybookThemes(paletteOf(globalThis.TARJA_TOKENS_CSS), globalThis.TARJA_VERSION);

addons.setConfig({ theme: THEMES.light });

addons.register('tarja/theme', (api) => {
    // Taken from the event, since the globals of the API catch up a tick later
    let theme: unknown = 'light';
    const apply = () => {
        api.setOptions({ theme: THEMES[resolveTheme(theme)] });
    };
    const onGlobals = (event: { globals?: { theme?: unknown } }) => {
        theme = event.globals?.theme;
        apply();
    };

    api.on(SET_GLOBALS, onGlobals);
    api.on(GLOBALS_UPDATED, onGlobals);
    window.matchMedia(DARK_SCHEME).addEventListener('change', apply);
});
