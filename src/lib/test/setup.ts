import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { installModalDialog, releaseModals } from './modal-dialog';

// jsdom does not implement them: the router scrolls on navigation, and a list scrolls a row into view
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

installModalDialog();

afterEach(() => {
    cleanup();
    releaseModals();
    Reflect.deleteProperty(window, 'matchMedia');
});
