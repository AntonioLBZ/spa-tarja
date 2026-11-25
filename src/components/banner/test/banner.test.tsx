import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BannerProvider, useBanner } from '@/components/banner/banner';

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

function swipe(dx: number, dy = 2) {
    const target = box()!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 60 } as DOMRect);
    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(target, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(target, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, isPrimary: true });
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
        expect(box()!.style.getPropertyValue('--swipe-x')).toBe('');
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('goes when it is swiped up by more than half its height', () => {
        setup();
        show();

        swipe(4, -40);

        expect(box()).toBeNull();
    });

    it('goes at once where it was let go, with no fade', () => {
        document.documentElement.style.setProperty('--duration-base', '200ms');
        setup();
        show();

        swipe(4, -150);

        expect(box()).toBeNull();
    });

    it('stays when it is swiped down, the way it never goes', () => {
        const { onOpen } = setup();
        show();

        swipe(4, 80);

        expect(box()).not.toBeNull();
        fireEvent.click(screen.getByText('Ana added Dinner'));
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('holds the count while it is dragged', () => {
        setup();
        show();
        const target = box()!;

        fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true });
        fireEvent.pointerMove(target, { clientX: 140, clientY: 100, pointerId: 1, isPrimary: true });
        elapse(9_000);

        expect(box()).not.toBeNull();
        expect(target.style.getPropertyValue('--swipe-x')).toBe('40px');
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
