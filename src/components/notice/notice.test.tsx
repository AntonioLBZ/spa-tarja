import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Notice } from './notice';

describe('Notice', () => {
    it('is a paragraph that holds only the message', () => {
        render(<Notice>Saved</Notice>);

        const notice = screen.getByText('Saved');
        expect(notice.tagName).toBe('P');
        expect(notice.textContent).toBe('Saved');
        expect(notice.classList.contains('notice')).toBe(true);
    });

    it.each(['info', 'danger', 'quiet'] as const)('takes the %s tone', (tone) => {
        render(<Notice tone={tone}>Message</Notice>);

        expect(screen.getByText('Message').classList.contains(`notice--${tone}`)).toBe(true);
    });

    it('is informative unless told otherwise', () => {
        render(<Notice>Message</Notice>);

        expect(screen.getByText('Message').classList.contains('notice--info')).toBe(true);
    });

    it.each(['alert', 'status'] as const)('announces itself as %s', (role) => {
        render(<Notice role={role}>Message</Notice>);

        expect(screen.getByRole(role).textContent).toBe('Message');
    });

    it('has no role unless one is given', () => {
        render(<Notice>Message</Notice>);

        expect(screen.getByText('Message').hasAttribute('role')).toBe(false);
    });

    it('carries an id for aria-describedby', () => {
        render(<Notice id="problem">Message</Notice>);

        expect(screen.getByText('Message').id).toBe('problem');
    });

    it('keeps the class the call site needs for its layout', () => {
        render(<Notice className="grow">Message</Notice>);

        const notice = screen.getByText('Message');
        expect(notice.classList.contains('notice')).toBe(true);
        expect(notice.classList.contains('grow')).toBe(true);
    });
});
