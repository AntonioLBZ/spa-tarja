import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BannerProvider, useBanner } from './banner';

function Harness(props: { onOpen: () => void; onGone: () => void }) {
    const { onOpen, onGone } = props;
    const banner = useBanner();

    return (
        <>
            <button
                type="button"
                onClick={() => banner.show({ title: 'Flat', message: 'Ana added Dinner', onOpen, onGone })}
            >
                Show
            </button>
            <button
                type="button"
                onClick={() => banner.show({ title: 'Flat', message: '2 new expenses', onOpen, onGone })}
            >
                Show more
            </button>
        </>
    );
}

function setup() {
    const onOpen = vi.fn();
    const onGone = vi.fn();
    render(
        <BannerProvider dismissLabel="Dismiss">
            <Harness onOpen={onOpen} onGone={onGone} />
        </BannerProvider>
    );
    return { onOpen, onGone };
}

function show(name = 'Show') {
    fireEvent.click(screen.getByRole('button', { name }));
}

function elapse(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

function box() {
    return document.querySelector<HTMLElement>('.banner');
}

function swipe(dx: number) {
    const target = box()!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ width: 300 } as DOMRect);
    fireEvent.pointerDown(target, { clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 100 + dx, clientY: 12, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 100 + dx, clientY: 12, pointerId: 1 });
}

beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty('--duration-base', '0ms');
});

afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty('--duration-base');
});

describe('Banner', () => {
    it('keeps an empty status region in the page from the start, so what comes in is announced', () => {
        setup();

        expect(screen.getByRole('status').childElementCount).toBe(0);
    });

    it('shows its title and its message in the status region, and leaves the focus where it was', () => {
        setup();
        const trigger = screen.getByRole('button', { name: 'Show' });
        trigger.focus();

        show();

        expect(screen.getByRole('status').textContent).toContain('Flat');
        expect(screen.getByRole('status').textContent).toContain('Ana added Dinner');
        expect(document.activeElement).toBe(trigger);
    });

    it('opens what it is about when it is pressed, and goes', () => {
        const { onOpen } = setup();
        show();

        fireEvent.click(screen.getByRole('button', { name: /Ana added Dinner/ }));

        expect(onOpen).toHaveBeenCalledOnce();
        expect(box()).toBeNull();
    });

    it('goes with its dismiss button, without opening anything', () => {
        const { onOpen } = setup();
        show();

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(box()).toBeNull();
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('goes with Escape while the focus is inside it, and not while it is elsewhere', () => {
        setup();
        show();

        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(box()).not.toBeNull();
        screen.getByRole('button', { name: 'Dismiss' }).focus();
        fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

        expect(box()).toBeNull();
    });

    it('goes by itself after 8 s', () => {
        setup();
        show();

        elapse(7_900);
        expect(box()).not.toBeNull();
        elapse(200);

        expect(box()).toBeNull();
    });

    it('holds the count while the pointer is over it', () => {
        setup();
        show();

        fireEvent.mouseEnter(box()!);
        elapse(20_000);
        expect(box()).not.toBeNull();
        fireEvent.mouseLeave(box()!);
        elapse(8_100);

        expect(box()).toBeNull();
    });

    it('takes the text of a new one in the same box and starts its 8 s again', () => {
        setup();
        show();
        elapse(6_000);

        show('Show more');
        elapse(6_000);

        expect(screen.getByRole('status').textContent).toContain('2 new expenses');
        expect(screen.getByRole('status').textContent).not.toContain('Ana added Dinner');
        elapse(2_100);
        expect(box()).toBeNull();
    });

    it('goes when it is swiped to the side by more than a third of its width', () => {
        setup();
        show();

        swipe(-120);

        expect(box()).toBeNull();
    });

    it('comes back when the swipe is shorter, and opens nothing', () => {
        const { onOpen } = setup();
        show();

        swipe(60);

        expect(box()).not.toBeNull();
        expect(box()!.style.getPropertyValue('--banner-shift')).toBe('');
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('says once that it is gone, however it goes, and not while a new text replaces the old one', () => {
        const { onGone } = setup();
        show();
        show('Show more');
        expect(onGone).not.toHaveBeenCalled();

        elapse(8_100);
        show();
        swipe(-200);

        expect(onGone).toHaveBeenCalledTimes(2);
    });
});
