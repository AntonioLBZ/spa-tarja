import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { elapse, pinned, root, setup, setupPin, show, swipe } from '@/lib/testing/toast';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    root.style.removeProperty('--duration-base');
});

describe('the room a Toast takes', () => {
    const observed: Array<() => void> = [];

    class FakeResizeObserver {
        constructor(callback: () => void) {
            observed.push(callback);
        }
        observe() {}
        disconnect() {}
    }

    afterEach(() => {
        observed.length = 0;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        root.style.removeProperty('--toast-height');
    });

    it('is written into --toast-height while a toast shows, for what scrolls to keep clear of it', () => {
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 92 } as DOMRect);
        setup();
        expect(root.style.getPropertyValue('--toast-height')).toBe('');

        show();
        act(() => observed.forEach((callback) => callback()));

        expect(root.style.getPropertyValue('--toast-height')).toBe('92px');
    });

    it('is taken away once the toast is gone', () => {
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 92 } as DOMRect);
        setup();
        show();
        act(() => observed.forEach((callback) => callback()));

        elapse(8_000);
        act(() => observed.forEach((callback) => callback()));

        expect(root.style.getPropertyValue('--toast-height')).toBe('');
    });
});

describe('a pinned Toast', () => {
    it('has no dismiss button: its answers close it', () => {
        setupPin();

        show('Pin');

        expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
        expect(within(screen.getByRole('status')).getAllByRole('button')).toHaveLength(2);
    });

    it('is not swiped away when it names no answer for a swipe', () => {
        setupPin();
        show('Pin');

        swipe(pinned()!, -200, 2);

        expect(pinned()).not.toBeNull();
    });

    it('is swiped away to a side or down when it names the answer a swipe gives, which runs', () => {
        for (const [dx, dy] of [
            [-200, 2],
            [200, 2],
            [2, 40],
        ]) {
            const onSwipeAway = vi.fn();
            const { unmount } = setupPin({ onSwipeAway });
            show('Pin');

            swipe(pinned()!, dx!, dy!);

            expect(pinned()).toBeNull();
            expect(onSwipeAway).toHaveBeenCalledTimes(1);
            unmount();
        }
    });

    it('stays when it is swiped up or not far enough, even when it names a swipe', () => {
        const onSwipeAway = vi.fn();
        setupPin({ onSwipeAway });
        show('Pin');

        swipe(pinned()!, 2, -80);
        swipe(pinned()!, 60, 2);

        expect(pinned()).not.toBeNull();
        expect(onSwipeAway).not.toHaveBeenCalled();
    });

    it('holds its message and one ghost action for each of its answers', () => {
        setupPin();

        show('Pin');

        const region = screen.getByRole('status');
        expect(region.textContent).toContain('A new version is ready');
        for (const name of ['Update', 'Later']) {
            const action = screen.getByRole('button', { name });
            expect(region.contains(action)).toBe(true);
            expect(action.classList.contains('button--ghost')).toBe(true);
        }
    });

    it('has no bar and no count: it stays until it is answered', () => {
        setupPin();

        show('Pin');

        expect(pinned()!.classList.contains('toast--pinned')).toBe(true);
        elapse(10 * 60_000);
        expect(pinned()).not.toBeNull();
    });

    it('goes with the action that answers it, after running it', () => {
        const onLater = vi.fn();
        setupPin({ onLater });
        show('Pin');

        fireEvent.click(screen.getByRole('button', { name: 'Later' }));

        expect(onLater).toHaveBeenCalledTimes(1);
        expect(pinned()).toBeNull();
    });

    it('goes when it is taken away', () => {
        setupPin();
        show('Pin');

        fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));

        expect(pinned()).toBeNull();
    });

    it('is not closed by Escape', () => {
        setupPin();
        show('Pin');

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(pinned()).not.toBeNull();
    });

    it('sits above the toast that goes away by itself, which does not replace it', () => {
        setupPin();
        show('Pin');

        show('Show');

        const region = screen.getByRole('status');
        const boxes = Array.from(region.querySelectorAll('.toast'));
        expect(boxes.map((box) => box.querySelector('p')!.textContent)).toEqual([
            'A new version is ready',
            'Deleted Lunch',
        ]);
        elapse(8_000);
        expect(screen.queryByText('Deleted Lunch')).toBeNull();
        expect(pinned()).not.toBeNull();
    });

    it('is not replaced by a toast that comes after it, and replaces only another pinned one', () => {
        setupPin();
        show('Pin');
        show('Show');
        expect(pinned()).not.toBeNull();

        show('Pin another');

        expect(pinned()).toBeNull();
        expect(screen.getByText('Another version')).toBeDefined();
        expect(screen.getAllByRole('button', { name: 'Go' })).toHaveLength(1);
    });

    it('keeps its box when it is pinned again with the same kind of content, so it does not come in twice', () => {
        setupPin();
        show('Pin');
        const box = pinned();

        show('Pin');

        expect(pinned()).toBe(box);
    });

    it('fades out before it goes, for as long as the transitions last', () => {
        root.style.setProperty('--duration-base', '200ms');
        setupPin();
        show('Pin');

        show('Unpin');

        expect(pinned()!.classList.contains('toast--leaving')).toBe(true);
        elapse(199);
        expect(pinned()).not.toBeNull();
        elapse(1);
        expect(pinned()).toBeNull();
    });
});
