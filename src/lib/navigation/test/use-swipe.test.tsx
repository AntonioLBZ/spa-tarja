import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSwipe, type SwipeDrag } from '@/lib/navigation/use-swipe';

import type { SwipeDirection } from '@/lib/navigation/route-transition';

interface AreaProps {
    begin: (direction: SwipeDirection) => SwipeDrag | undefined;
    on?: boolean;
}

const Area = (props: AreaProps) => {
    const { begin, on = true } = props;
    const main = useRef<HTMLElement>(null);
    useSwipe(main, begin, on);

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

const show = (on = true, ends = false) => {
    const onSwipe = vi.fn();
    const follow = vi.fn();
    const begin = vi.fn((direction: SwipeDirection): SwipeDrag | undefined => {
        if (ends) return undefined;
        return { follow, release: (go) => (go ? onSwipe(direction) : undefined) };
    });
    const view = render(<Area begin={begin} on={on} />);
    return { onSwipe, begin, follow, view };
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

    it('follows the finger as a share of the screen once it goes clearly sideways', () => {
        const { begin, follow } = show();
        const width = window.innerWidth;

        press('pointerdown', text(), 800, 300);
        press('pointermove', text(), 795, 300);
        expect(begin).not.toHaveBeenCalled();
        press('pointermove', text(), 800 - width / 4, 300);
        press('pointermove', text(), 800 - width / 2, 300);

        expect(begin).toHaveBeenCalledExactlyOnceWith('next');
        expect(follow.mock.calls).toEqual([[0.25], [0.5]]);
    });

    it('goes back when the finger comes back before it lifts, or the touch is taken away', () => {
        const { onSwipe } = show();

        press('pointerdown', text(), 800, 300);
        press('pointermove', text(), 500, 300);
        press('pointermove', text(), 790, 300);
        press('pointerup', text(), 790, 300);
        press('pointerdown', text(), 800, 300);
        press('pointermove', text(), 300, 300);
        press('pointercancel', text(), 300, 300);

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('lets go of a stroke where there is nothing more to go to', () => {
        const { begin, follow } = show(true, true);

        drag(text(), 800, 300);

        expect(begin).toHaveBeenCalledOnce();
        expect(follow).not.toHaveBeenCalled();
    });

    it('swallows the click at the end of a swipe that came back to where it started', () => {
        show();
        const onClick = vi.fn();
        const link = document.querySelector('a')!;
        link.addEventListener('click', onClick);

        press('pointerdown', link, 500, 300);
        press('pointermove', link, 300, 300);
        press('pointerup', link, 500, 300);
        link.click();

        expect(onClick).not.toHaveBeenCalled();
    });

    it('does nothing while off', () => {
        const { onSwipe } = show(false);

        drag(text(), 800, 300);

        expect(onSwipe).not.toHaveBeenCalled();
    });
});
