import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MonthComb } from './month-comb';

// Ticks 10 wide with a gap of 2 inside a week and 30 between weeks, and a box a lot wider than all of them
const placeTicks = (root: HTMLElement) => {
    const lefts = [0, 12, 24, 36, 78, 90, 102];
    root.querySelectorAll<HTMLElement>('.month-comb__tick').forEach((tick, index) => {
        const left = lefts[index] ?? 0;
        tick.getBoundingClientRect = () => new DOMRect(left, 0, 10, 40);
    });
};

const setup = () => {
    const onScrub = vi.fn();
    const onPick = vi.fn();
    const { container } = render(
        <MonthComb days={[0, 0, 0, 0, 0, 0, 0]} today={0} firstWeekday={1} onScrub={onScrub} onPick={onPick} />
    );
    const comb = container.querySelector<HTMLElement>('.month-comb')!;
    comb.getBoundingClientRect = () => new DOMRect(0, 0, 400, 80);
    placeTicks(comb);
    return { comb, onScrub, onPick };
};

describe('MonthComb', () => {
    it('reads the day whose tick is nearest the pointer, not the day at that share of the box', () => {
        const { comb, onScrub } = setup();

        fireEvent.pointerMove(comb, { pointerType: 'mouse', clientX: 82 });

        expect(onScrub).toHaveBeenLastCalledWith(5);
    });

    it('takes the pointer in a gap to the nearer tick', () => {
        const { comb, onScrub } = setup();

        fireEvent.pointerMove(comb, { pointerType: 'mouse', clientX: 50 });
        expect(onScrub).toHaveBeenLastCalledWith(4);

        fireEvent.pointerMove(comb, { pointerType: 'mouse', clientX: 70 });
        expect(onScrub).toHaveBeenLastCalledWith(5);
    });

    it('lets go of the day when the pointer leaves', () => {
        const { comb, onScrub } = setup();

        fireEvent.pointerMove(comb, { pointerType: 'mouse', clientX: 14 });
        fireEvent.pointerLeave(comb);

        expect(onScrub).toHaveBeenLastCalledWith(null);
    });

    it('picks the day that was tapped', () => {
        const { comb, onPick } = setup();

        fireEvent.pointerDown(comb, { pointerType: 'touch', clientX: 104 });
        fireEvent.pointerUp(comb, { pointerType: 'touch', clientX: 104 });

        expect(onPick).toHaveBeenCalledWith(7);
    });
});
