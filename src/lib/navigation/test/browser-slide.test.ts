import { afterEach, describe, expect, it } from 'vitest';

import { leaveSlidesToTheBrowser } from '@/lib/navigation/browser-slide';
import { takeSkippedSlide } from '@/lib/navigation/swipe-slide';

const pop = (hasUAVisualTransition?: boolean) => {
    const event = new PopStateEvent('popstate');
    if (hasUAVisualTransition !== undefined) {
        Object.defineProperty(event, 'hasUAVisualTransition', { value: hasUAVisualTransition });
    }
    window.dispatchEvent(event);
};

describe('leaveSlidesToTheBrowser', () => {
    let stop: () => void = () => undefined;

    afterEach(() => {
        stop();
        takeSkippedSlide();
    });

    it('skips the slide of a step through the history the browser already drew', () => {
        stop = leaveSlidesToTheBrowser();

        pop(true);

        expect(takeSkippedSlide()).toBe(true);
    });

    it('keeps the slide of a step the browser drew nothing for, or that it says nothing about', () => {
        stop = leaveSlidesToTheBrowser();

        pop(false);
        pop();

        expect(takeSkippedSlide()).toBe(false);
    });

    it('stops listening once stopped', () => {
        leaveSlidesToTheBrowser()();

        pop(true);

        expect(takeSkippedSlide()).toBe(false);
    });
});
