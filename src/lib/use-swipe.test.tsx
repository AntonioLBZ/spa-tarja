import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSwipe } from './use-swipe';

import type { SwipeDirection } from './route-transition';

interface AreaProps {
    onSwipe: (direction: SwipeDirection) => void;
    on?: boolean;
}

const Area = (props: AreaProps) => {
    const { onSwipe, on = true } = props;
    const main = useRef<HTMLElement>(null);
    useSwipe(main, onSwipe, on);

    return (
        <>
            <main ref={main}>
                <p>Text</p>
                <a href="#x">Link</a>
                <input aria-label="Field" />
                <div data-no-swipe>Kept</div>
            </main>
            <footer>Bar</footer>
        </>
    );
};

const show = (on = true) => {
    const onSwipe = vi.fn();
    const view = render(<Area onSwipe={onSwipe} on={on} />);
    return { onSwipe, view };
};

const press = (type: string, target: Element, x: number, y: number, init: PointerEventInit = {}) => {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            isPrimary: true,
            pointerId: 1,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
            ...init,
        })
    );
};

const drag = (target: Element, from: number, to: number, init: PointerEventInit & { dy?: number } = {}) => {
    const { dy = 0, ...rest } = init;
    press('pointerdown', target, from, 300, rest);
    press('pointermove', target, (from + to) / 2, 300 + dy / 2, rest);
    press('pointerup', target, to, 300 + dy, rest);
};

const text = () => document.querySelector('p')!;

afterEach(() => {
    Reflect.deleteProperty(document, 'activeViewTransition');
});

describe('useSwipe', () => {
    it('asks for the next screen on a swipe to the left and the previous one on a swipe to the right', () => {
        const { onSwipe } = show();

        drag(text(), 800, 300);
        drag(text(), 300, 800);

        expect(onSwipe.mock.calls).toEqual([['next'], ['previous']]);
    });

    it('takes a short flick as a swipe', () => {
        const { onSwipe } = show();

        drag(text(), 500, 430);

        expect(onSwipe).toHaveBeenCalledWith('next');
    });

    it('leaves alone a tap, a drag that goes mostly down and a mouse', () => {
        const { onSwipe } = show();

        drag(text(), 500, 495);
        drag(text(), 800, 300, { dy: 400 });
        drag(text(), 800, 300, { pointerType: 'mouse' });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('leaves the edges of the screen to the back gesture of the system', () => {
        const { onSwipe } = show();

        drag(text(), 10, 600);
        drag(text(), window.innerWidth - 10, 300);

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('never starts on a field, on what asks for none or outside the area', () => {
        const { onSwipe } = show();

        drag(document.querySelector('input')!, 800, 300);
        drag(document.querySelector('[data-no-swipe]')!, 800, 300);
        drag(document.querySelector('footer')!, 800, 300);

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('takes a touch on the root while a slide runs, since the browser sends it there', () => {
        const { onSwipe } = show();
        drag(document.documentElement, 800, 300);
        expect(onSwipe).not.toHaveBeenCalled();

        Object.defineProperty(document, 'activeViewTransition', { configurable: true, value: {} });
        drag(document.documentElement, 800, 300);

        expect(onSwipe).toHaveBeenCalledWith('next');
    });

    it('swallows the click a browser may send at the end of a swipe, and no later one', () => {
        show();
        const onClick = vi.fn();
        const link = document.querySelector('a')!;
        link.addEventListener('click', onClick);

        drag(link, 800, 300);
        link.click();
        link.click();

        expect(onClick).toHaveBeenCalledOnce();
    });

    it('does nothing while off', () => {
        const { onSwipe } = show(false);

        drag(text(), 800, 300);

        expect(onSwipe).not.toHaveBeenCalled();
    });
});
