import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useFocusSource } from './use-focus-source';

const Probe = () => {
    useFocusSource();

    return null;
};

const source = () => document.documentElement.dataset.focusSource;

describe('useFocusSource', () => {
    afterEach(() => {
        delete document.documentElement.dataset.focusSource;
    });

    it('starts from a pointer', () => {
        render(<Probe />);

        expect(source()).toBe('pointer');
    });

    it('says keyboard once Tab moves the focus, and pointer again after a press', () => {
        render(<Probe />);

        fireEvent.keyDown(document.body, { key: 'Tab' });
        expect(source()).toBe('keyboard');

        fireEvent.pointerDown(document.body);
        expect(source()).toBe('pointer');
    });

    it('stays as it was while other keys are typed', () => {
        render(<Probe />);

        fireEvent.keyDown(document.body, { key: 'Tab' });
        fireEvent.keyDown(document.body, { key: 'a' });
        expect(source()).toBe('keyboard');

        fireEvent.pointerDown(document.body);
        fireEvent.keyDown(document.body, { key: 'Enter' });
        expect(source()).toBe('pointer');
    });

    it('leaves nothing behind once it is gone', () => {
        const { unmount } = render(<Probe />);
        unmount();

        expect(source()).toBeUndefined();
        fireEvent.keyDown(document.body, { key: 'Tab' });
        expect(source()).toBeUndefined();
    });
});
