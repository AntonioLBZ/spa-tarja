import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    beginSwipe,
    decideSwipe,
    expectArrival,
    focusHeading,
    markSwiped,
    markUndone,
    sayWhenSwipeIsDecided,
    showHeading,
    takeArrival,
    takeSwiped,
    takeUndone,
} from '@/lib/a11y/screen-arrival';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    takeArrival();
    takeSwiped();
    takeUndone();
    decideSwipe(true);
    showHeading(null);
    vi.useRealTimers();
});

describe('an arrival', () => {
    it('is taken once, by the first heading that asks', () => {
        expectArrival('focus');

        expect(takeArrival()).toBe('focus');
        expect(takeArrival()).toBeNull();
    });

    it('is forgotten when the heading takes too long, so a later heading is not its arrival', () => {
        expectArrival('announce');

        vi.advanceTimersByTime(2_500);

        expect(takeArrival()).toBeNull();
    });

    it('is replaced by a newer one', () => {
        expectArrival('announce');
        expectArrival('focus');

        expect(takeArrival()).toBe('focus');
    });
});

describe('a swipe', () => {
    it('is marked for the next change of screen only', () => {
        markSwiped();

        expect(takeSwiped()).toBe(true);
        expect(takeSwiped()).toBe(false);
    });

    it('is forgotten when no change of screen came of it', () => {
        markSwiped();

        vi.advanceTimersByTime(1_500);

        expect(takeSwiped()).toBe(false);
    });
});

describe('a swipe that goes back', () => {
    it('is marked for the next change of screen only', () => {
        markUndone();

        expect(takeUndone()).toBe(true);
        expect(takeUndone()).toBe(false);
    });

    it('is forgotten when no change of screen came of it', () => {
        markUndone();

        vi.advanceTimersByTime(1_500);

        expect(takeUndone()).toBe(false);
    });
});

describe('what is said of a swiped screen', () => {
    it('is said at once when no swipe is deciding', () => {
        const say = vi.fn();

        sayWhenSwipeIsDecided(say);

        expect(say).toHaveBeenCalledOnce();
    });

    it('waits for the finger to lift, and is said if the swipe goes on', () => {
        const say = vi.fn();
        beginSwipe();

        sayWhenSwipeIsDecided(say);
        expect(say).not.toHaveBeenCalled();
        decideSwipe(true);

        expect(say).toHaveBeenCalledOnce();
    });

    it('is never said if the swipe goes back', () => {
        const say = vi.fn();
        beginSwipe();

        sayWhenSwipeIsDecided(say);
        decideSwipe(false);
        decideSwipe(true);

        expect(say).not.toHaveBeenCalled();
    });

    it('is said at once by a screen that shows up after the swipe went on, and never after it went back', () => {
        const after = vi.fn();
        const back = vi.fn();

        beginSwipe();
        decideSwipe(true);
        sayWhenSwipeIsDecided(after);
        beginSwipe();
        decideSwipe(false);
        sayWhenSwipeIsDecided(back);

        expect(after).toHaveBeenCalledOnce();
        expect(back).not.toHaveBeenCalled();
    });

    it('is forgotten when another swipe starts', () => {
        const say = vi.fn();
        beginSwipe();
        sayWhenSwipeIsDecided(say);

        beginSwipe();
        decideSwipe(true);

        expect(say).not.toHaveBeenCalled();
    });
});

describe('the heading of the screen', () => {
    it('takes the focus when asked to', () => {
        const heading = document.createElement('h1');
        heading.tabIndex = -1;
        document.body.appendChild(heading);
        showHeading(heading);

        focusHeading();

        expect(document.activeElement).toBe(heading);
        heading.remove();
    });

    it('is nothing to focus once the screen is gone', () => {
        const heading = document.createElement('h1');
        heading.tabIndex = -1;
        document.body.appendChild(heading);
        showHeading(heading);
        showHeading(null);

        focusHeading();

        expect(document.activeElement).toBe(document.body);
        heading.remove();
    });
});
