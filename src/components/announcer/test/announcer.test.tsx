import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncerProvider, useAnnounce } from '@/components/announcer/announcer';

const Say = (props: { message: string }) => {
    const announce = useAnnounce();

    return (
        <button type="button" onClick={() => announce(props.message)}>
            Say
        </button>
    );
};

const setup = (message = 'Expense added') => {
    render(
        <AnnouncerProvider>
            <Say message={message} />
        </AnnouncerProvider>
    );
};

const region = () => screen.getByRole('status');

const elapse = (ms: number) => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Announcer', () => {
    it('keeps a polite status in the page that is empty until something is said', () => {
        setup();

        expect(region().textContent).toBe('');
        expect(region().classList.contains('visually-hidden')).toBe(true);
    });

    it('says a message inside the status that was already there', () => {
        setup();
        const before = region();

        fireEvent.click(screen.getByRole('button', { name: 'Say' }));
        elapse(200);

        expect(region()).toBe(before);
        expect(region().textContent).toBe('Expense added');
    });

    it('empties the status first, so the same message said twice is read twice', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Say' }));
        elapse(200);
        fireEvent.click(screen.getByRole('button', { name: 'Say' }));

        expect(region().textContent).toBe('');
        elapse(200);
        expect(region().textContent).toBe('Expense added');
    });

    it('says nothing where there is no provider, instead of failing', () => {
        render(<Say message="Expense added" />);

        fireEvent.click(screen.getByRole('button', { name: 'Say' }));

        expect(screen.queryByRole('status')).toBeNull();
    });
});
