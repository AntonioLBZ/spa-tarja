import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubPageScroll, type PageScroll } from '@/lib/test/scroll';

import { useHideOnScroll } from './use-hide-on-scroll';

const HEADER_HEIGHT = 60;
const PAGE_HEIGHT = 3000;
const END = PAGE_HEIGHT - window.innerHeight;

const Probe = () => {
    const header = useRef<HTMLElement>(null);
    const hidden = useHideOnScroll(header);

    return <header ref={header}>{hidden ? 'hidden' : 'shown'}</header>;
};

describe('useHideOnScroll', () => {
    let page: PageScroll;

    const scroll = (...tops: number[]) => {
        for (const top of tops) act(() => page.scrollTo(top));
    };

    const state = () => screen.getByRole('banner').textContent;

    beforeEach(() => {
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(HEADER_HEIGHT);
        page = stubPageScroll(PAGE_HEIGHT);
        render(<Probe />);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts in place', () => {
        expect(state()).toBe('shown');
    });

    it('stays in place while the page is scrolled less than the header is tall', () => {
        scroll(20, 40, HEADER_HEIGHT);

        expect(state()).toBe('shown');
    });

    it('slides out once the page has gone 8 px down past its own height', () => {
        scroll(HEADER_HEIGHT, HEADER_HEIGHT + 7);
        expect(state()).toBe('shown');

        scroll(HEADER_HEIGHT + 8);
        expect(state()).toBe('hidden');
    });

    it('slides out at once when the page jumps down far', () => {
        scroll(400);

        expect(state()).toBe('hidden');
    });

    it('stays out while the page keeps going down', () => {
        scroll(300, 500, 900, 1500);

        expect(state()).toBe('hidden');
    });

    it('slides back once the page has gone 8 px up, counted from the lowest point', () => {
        scroll(300, 500);

        scroll(493);
        expect(state()).toBe('hidden');

        scroll(492);
        expect(state()).toBe('shown');
    });

    it('counts the 8 px down from the nearest point to the top since it came back', () => {
        scroll(300, 500, 490, 495, 480, 487);
        expect(state()).toBe('shown');

        scroll(488);
        expect(state()).toBe('hidden');
    });

    it('is not flickered by a hand that shakes', () => {
        scroll(300, 305, 302, 307, 304, 309);

        expect(state()).toBe('hidden');
        scroll(302, 306, 303);
        expect(state()).toBe('hidden');
    });

    it('comes back at the top, however it got there', () => {
        scroll(300);

        scroll(0);

        expect(state()).toBe('shown');
    });

    it('goes out again on the next scroll down', () => {
        scroll(300, 280);
        expect(state()).toBe('shown');

        scroll(300);
        expect(state()).toBe('hidden');
    });

    it('takes the rubber band past the top for the top', () => {
        scroll(300);

        scroll(-30);

        expect(state()).toBe('shown');
    });

    it('is not moved by the rubber band past the end of the page', () => {
        scroll(300, END);
        expect(state()).toBe('hidden');

        scroll(END + 40, END + 20, END);

        expect(state()).toBe('hidden');
    });

    it('never hides on a page that does not scroll', () => {
        stubPageScroll(window.innerHeight - 100);

        scroll(300);

        expect(state()).toBe('shown');
    });

    it('stops listening when it unmounts', () => {
        const remove = vi.spyOn(window, 'removeEventListener');

        const { unmount } = render(<Probe />);
        unmount();

        expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    });
});
