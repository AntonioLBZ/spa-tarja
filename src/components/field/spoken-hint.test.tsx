import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpokenHint } from './spoken-hint';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SpokenHint', () => {
    it('shows the hint at once, hidden from assistive technology, which hears it from the status instead', () => {
        const { rerender } = render(<SpokenHint>{false}</SpokenHint>);

        rerender(<SpokenHint>€5.00 left to assign</SpokenHint>);

        const hint = screen.getByText('€5.00 left to assign', { selector: 'p' });
        expect(hint.classList.contains('field__hint')).toBe(true);
        expect(hint.getAttribute('aria-hidden')).toBe('true');
        expect(screen.getByRole('status').textContent).toBe('');
    });

    it('is read out only once the text has held still for half a second', () => {
        const { rerender } = render(<SpokenHint>{false}</SpokenHint>);

        rerender(<SpokenHint>€5.00 left to assign</SpokenHint>);
        act(() => vi.advanceTimersByTime(300));
        rerender(<SpokenHint>€4.00 left to assign</SpokenHint>);
        act(() => vi.advanceTimersByTime(499));
        expect(screen.getByRole('status').textContent).toBe('');

        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByRole('status').textContent).toBe('€4.00 left to assign');
    });

    it('keeps its status in the page when there is nothing to say, and shows no hint', () => {
        const { rerender } = render(<SpokenHint>{false}</SpokenHint>);
        rerender(<SpokenHint>€5.00 left to assign</SpokenHint>);
        act(() => vi.advanceTimersByTime(500));
        const status = screen.getByRole('status');

        rerender(<SpokenHint>{false}</SpokenHint>);
        act(() => vi.advanceTimersByTime(500));

        expect(screen.getByRole('status')).toBe(status);
        expect(status.textContent).toBe('');
        expect(document.querySelector('.field__hint')).toBeNull();
    });
});
