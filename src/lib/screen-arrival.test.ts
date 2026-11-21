import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectArrival, focusHeading, markSwiped, showHeading, takeArrival, takeSwiped } from './screen-arrival';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    takeArrival();
    takeSwiped();
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
