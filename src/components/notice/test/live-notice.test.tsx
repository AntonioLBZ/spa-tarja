import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveNotice } from '@/components/notice/live-notice';

describe('LiveNotice', () => {
    it('keeps a polite status in the page that is empty while there is nothing to say', () => {
        render(<LiveNotice>{false}</LiveNotice>);

        const region = screen.getByRole('status');
        expect(region.textContent).toBe('');
        expect(region.classList.contains('live-notice')).toBe(true);
        expect(document.querySelector('.notice')).toBeNull();
    });

    it('puts the message in a notice inside the status, which stays the same element as it comes and goes', () => {
        const { rerender } = render(<LiveNotice>{false}</LiveNotice>);
        const region = screen.getByRole('status');

        rerender(<LiveNotice>You are offline</LiveNotice>);

        expect(screen.getByRole('status')).toBe(region);
        const notice = screen.getByText('You are offline');
        expect(region.contains(notice)).toBe(true);
        expect(notice.classList.contains('notice')).toBe(true);
        expect(notice.hasAttribute('role')).toBe(false);

        rerender(<LiveNotice>{''}</LiveNotice>);

        expect(screen.getByRole('status')).toBe(region);
        expect(region.textContent).toBe('');
    });

    it.each(['info', 'danger', 'quiet'] as const)('gives the notice the %s tone', (tone) => {
        render(<LiveNotice tone={tone}>Message</LiveNotice>);

        expect(screen.getByText('Message').classList.contains(`notice--${tone}`)).toBe(true);
    });
});
