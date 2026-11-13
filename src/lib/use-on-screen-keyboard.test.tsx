import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useOnScreenKeyboard } from './use-on-screen-keyboard';

const Probe = () => {
    useOnScreenKeyboard();

    return <input aria-label="text" />;
};

const fakeViewport = (height: number) => {
    const viewport = Object.assign(new EventTarget(), { height, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    return {
        resize: (next: number, scale = 1) => {
            viewport.height = next;
            viewport.scale = scale;
            viewport.dispatchEvent(new Event('resize'));
        },
    };
};

const keyboard = () => document.documentElement.dataset.keyboard;

describe('useOnScreenKeyboard', () => {
    afterEach(() => Reflect.deleteProperty(window, 'visualViewport'));

    it('says open while the keyboard covers the page and drops it when it closes, leaving the focus alone', () => {
        const viewport = fakeViewport(800);
        const { getByLabelText, unmount } = render(<Probe />);
        const field = getByLabelText('text');
        field.focus();
        expect(keyboard()).toBeUndefined();

        viewport.resize(450);
        expect(keyboard()).toBe('open');

        viewport.resize(800);
        expect(keyboard()).toBeUndefined();
        expect(document.activeElement).toBe(field);

        viewport.resize(450);
        unmount();
        expect(keyboard()).toBeUndefined();
    });

    it('is open when the page starts with the keyboard up', () => {
        fakeViewport(450);
        render(<Probe />);

        expect(keyboard()).toBe('open');
    });

    it('ignores a small loss, such as a bar of the browser', () => {
        const viewport = fakeViewport(800);
        render(<Probe />);

        viewport.resize(760);

        expect(keyboard()).toBeUndefined();
    });

    it('does nothing without a visual viewport', () => {
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });

        expect(() => render(<Probe />)).not.toThrow();
        expect(keyboard()).toBeUndefined();
    });
});
