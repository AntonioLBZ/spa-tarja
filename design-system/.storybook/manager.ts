import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';
import { addons } from 'storybook/manager-api';

import { paletteOf } from './palette';
import { DARK_SCHEME, resolveTheme, storybookThemes } from './themes';

// `tokens.css` and the version of `package.json`, written into the head of the manager by `managerHead`
declare global {
    var TARJA_TOKENS_CSS: string;
    var TARJA_VERSION: string;
}

const THEMES = storybookThemes(paletteOf(globalThis.TARJA_TOKENS_CSS), globalThis.TARJA_VERSION);

addons.setConfig({ theme: THEMES.light });

addons.register('tarja/theme', (api) => {
    const apply = () => {
        api.setOptions({ theme: THEMES[resolveTheme(api.getGlobals().theme)] });
    };

    api.on(SET_GLOBALS, apply);
    api.on(GLOBALS_UPDATED, apply);
    window.matchMedia(DARK_SCHEME).addEventListener('change', apply);
});
