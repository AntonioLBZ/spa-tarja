import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

function box() {
    return screen.getByRole('checkbox', { name: 'Show in my expenses' }) as HTMLInputElement;
}

describe('Checkbox', () => {
    it('is a native checkbox named by its label', () => {
        render(<Checkbox label="Show in my expenses" checked onChange={() => undefined} />);

        expect(box().type).toBe('checkbox');
        expect(box().checked).toBe(true);
    });

    it('is described by its hint', () => {
        render(
            <Checkbox label="Show in my expenses" hint="Only for you." checked={false} onChange={() => undefined} />
        );

        const hint = screen.getByText('Only for you.');
        expect(box().getAttribute('aria-describedby')).toBe(hint.id);
    });

    it('has no description without a hint', () => {
        render(<Checkbox label="Show in my expenses" checked={false} onChange={() => undefined} />);

        expect(box().hasAttribute('aria-describedby')).toBe(false);
    });

    it('tells what the label turns it to when pressed', () => {
        const onChange = vi.fn();
        render(<Checkbox label="Show in my expenses" checked={false} onChange={onChange} />);

        fireEvent.click(screen.getByText('Show in my expenses'));

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('turns off with the rest of the screen', () => {
        render(<Checkbox label="Show in my expenses" checked disabled onChange={() => undefined} />);

        expect(box().disabled).toBe(true);
    });

    it('draws its mark with the icons of the interface, hidden from assistive technology', () => {
        const { container } = render(<Checkbox label="Show in my expenses" checked onChange={() => undefined} />);

        const mark = container.querySelector('[data-icon="check"]');
        expect(mark).not.toBeNull();
        expect(mark?.getAttribute('aria-hidden')).toBe('true');
    });
});
