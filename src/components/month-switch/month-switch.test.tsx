import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MonthSwitch } from './month-switch';

const labels = { previous: 'Earlier', next: 'Later' };

function renderSwitch(props: Partial<Parameters<typeof MonthSwitch>[0]> = {}) {
    return render(
        <MonthSwitch
            monthName="october 2026"
            labels={labels}
            onPrevious={() => undefined}
            onNext={() => undefined}
            {...props}
        />
    );
}

describe('MonthSwitch', () => {
    it('shows the name of the month between a previous and a next button', () => {
        renderSwitch();

        const previous = screen.getByRole('button', { name: labels.previous });
        const next = screen.getByRole('button', { name: labels.next });
        const name = screen.getByText('october 2026');
        expect(previous.compareDocumentPosition(name)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(name.compareDocumentPosition(next)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('asks for the previous and the next month when each button is pressed', () => {
        const onPrevious = vi.fn();
        const onNext = vi.fn();
        renderSwitch({ onPrevious, onNext });

        fireEvent.click(screen.getByRole('button', { name: labels.next }));
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrevious).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: labels.previous }));
        expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it('does not submit a form it sits in', () => {
        const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
        render(
            <form onSubmit={onSubmit}>
                <MonthSwitch
                    monthName="october 2026"
                    labels={labels}
                    onPrevious={() => undefined}
                    onNext={() => undefined}
                />
            </form>
        );

        fireEvent.click(screen.getByRole('button', { name: labels.next }));

        expect(onSubmit).not.toHaveBeenCalled();
    });
});
