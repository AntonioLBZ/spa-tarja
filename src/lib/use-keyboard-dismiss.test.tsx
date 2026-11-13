import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useKeyboardDismiss } from './use-keyboard-dismiss';

const Probe = () => {
    useKeyboardDismiss();

    return (
        <>
            <input aria-label="text" />
            <input aria-label="box" type="checkbox" />
        </>
    );
};

const fakeViewport = (height: number) => {
    const viewport = Object.assign(new EventTarget(), { height, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    return {
        resize: (next: number) => {
            viewport.height = next;
            viewport.dispatchEvent(new Event('resize'));
        },
    };
};

describe('useKeyboardDismiss', () => {
    afterEach(() => Reflect.deleteProperty(window, 'visualViewport'));

    it('blurs the text field when the keyboard closes', () => {
        const viewport = fakeViewport(800);
        const { getByLabelText } = render(<Probe />);
        const field = getByLabelText('text');

        field.focus();
        viewport.resize(450);
        expect(document.activeElement).toBe(field);

        viewport.resize(800);
        expect(document.activeElement).not.toBe(field);
    });

    it('leaves the focus alone when the viewport shrinks and never opened a keyboard', () => {
        const viewport = fakeViewport(800);
        const { getByLabelText } = render(<Probe />);
        const field = getByLabelText('text');

        field.focus();
        viewport.resize(760);
        viewport.resize(800);

        expect(document.activeElement).toBe(field);
    });

    it('leaves a checkbox alone', () => {
        const viewport = fakeViewport(800);
        const { getByLabelText } = render(<Probe />);
        const box = getByLabelText('box');

        viewport.resize(450);
        box.focus();
        viewport.resize(800);

        expect(document.activeElement).toBe(box);
    });

    it('does nothing without a visual viewport', () => {
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });

        expect(() => render(<Probe />)).not.toThrow();
    });
});
