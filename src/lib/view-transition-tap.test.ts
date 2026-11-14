import { afterEach, describe, expect, it, vi } from 'vitest';

import { endTransitionsOnTap } from './view-transition-tap';

const stubTransition = () => {
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const skipTransition = vi.fn(() => finish());
    Object.defineProperty(document, 'activeViewTransition', {
        configurable: true,
        value: { finished, skipTransition },
    });
    return skipTransition;
};

const placeButton = () => {
    const button = document.createElement('button');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    document.body.appendChild(button);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => button });
    return onClick;
};

const tap = (init: PointerEventInit = {}) => {
    document.dispatchEvent(
        new PointerEvent('pointerup', { isPrimary: true, button: 0, clientX: 5, clientY: 6, ...init })
    );
};

describe('endTransitionsOnTap', () => {
    let stop: () => void = () => undefined;

    afterEach(() => {
        stop();
        document.body.replaceChildren();
        Reflect.deleteProperty(document, 'activeViewTransition');
        Reflect.deleteProperty(document, 'elementFromPoint');
    });

    it('ends the running transition on a tap and repeats the tap on the page under it', async () => {
        const skipTransition = stubTransition();
        const onClick = placeButton();
        stop = endTransitionsOnTap();

        tap();

        expect(skipTransition).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(onClick).toHaveBeenCalledOnce());
    });

    it('repeats the tap as a click a link can cancel', async () => {
        stubTransition();
        const onClick = placeButton();
        stop = endTransitionsOnTap();

        tap();

        await vi.waitFor(() => expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ cancelable: true })));
    });

    it('leaves a tap alone while no transition runs', async () => {
        const onClick = placeButton();
        stop = endTransitionsOnTap();

        tap();

        await Promise.resolve();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('ignores a press that is not the main button', () => {
        const skipTransition = stubTransition();
        stop = endTransitionsOnTap();

        tap({ button: 2 });

        expect(skipTransition).not.toHaveBeenCalled();
    });
});
