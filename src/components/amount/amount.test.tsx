import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Amount } from './amount';

describe('Amount', () => {
    it('shows only the text without cues', () => {
        const { container } = render(<Amount text="€20.00" direction="in" />);

        expect(container.textContent).toBe('€20.00');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.firstElementChild?.className).toBe('amount');
    });

    it('signs what adds to a balance and what takes from it, hidden from assistive technology', () => {
        const { rerender, container } = render(<Amount text="€20.00" direction="in" sign />);
        expect(container.textContent).toBe('+€20.00');
        expect(screen.getByText('+').getAttribute('aria-hidden')).toBe('true');

        rerender(<Amount text="€20.00" direction="out" sign />);
        expect(container.textContent).toBe('−€20.00');
    });

    it('reads the sign aloud where no words say which way it goes', () => {
        render(<Amount text="€20.00" direction="out" sign spokenSign />);

        expect(screen.getByText('−').hasAttribute('aria-hidden')).toBe(false);
    });

    it('colors the amount by its direction', () => {
        const { rerender, container } = render(<Amount text="€20.00" direction="in" color />);
        expect(container.firstElementChild?.classList.contains('amount--in')).toBe(true);

        rerender(<Amount text="€20.00" direction="out" color />);
        expect(container.firstElementChild?.classList.contains('amount--out')).toBe(true);
    });

    it('points up for what comes in and down for what goes out', () => {
        const { rerender, container } = render(<Amount text="€20.00" direction="in" arrow />);
        expect(container.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('north_east');

        rerender(<Amount text="€20.00" direction="out" arrow />);
        expect(container.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('south_east');
    });

    it('shows no cue for an amount that goes nowhere', () => {
        const { container } = render(<Amount text="€0.00" color sign arrow />);

        expect(container.textContent).toBe('€0.00');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.firstElementChild?.className).toBe('amount');
    });
});
