import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement them: the router scrolls on navigation, and Edit brings the add form into view
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

// jsdom has no modal <dialog>: a test only needs it to open, to close and to say so
HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
};

afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, 'matchMedia');
});
