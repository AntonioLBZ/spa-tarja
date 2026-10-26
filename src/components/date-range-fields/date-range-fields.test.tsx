import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DateRangeFields } from './date-range-fields';

const labels = { from: 'From', to: 'To' };

function setup(props: Partial<Parameters<typeof DateRangeFields>[0]> = {}) {
    const onChange = vi.fn();
    const view = render(
        <DateRangeFields from="2026-10-01" to="2026-10-31" labels={labels} onChange={onChange} {...props} />
    );
    const from = screen.getByLabelText('From') as HTMLInputElement;
    const to = screen.getByLabelText('To') as HTMLInputElement;
    return { onChange, from, to, view };
}

describe('DateRangeFields', () => {
    it('shows both days in date fields', () => {
        const { from, to } = setup();

        expect([from.type, from.value]).toEqual(['date', '2026-10-01']);
        expect([to.type, to.value]).toEqual(['date', '2026-10-31']);
    });

    it('puts the two fields side by side in a grid of their own', () => {
        const { view } = setup();

        expect(view.container.querySelector('.date-range-fields')?.querySelectorAll('.field')).toHaveLength(2);
    });

    it('reports a whole day for the end that changed', () => {
        const { onChange, from } = setup();

        fireEvent.change(from, { target: { value: '2026-10-05' } });

        expect(onChange).toHaveBeenCalledExactlyOnceWith('from', '2026-10-05');
    });

    it('keeps a half typed day in the field without reporting it, and goes back when the field is left', () => {
        const { onChange, from } = setup();

        for (const partial of ['0002-10-05', '0020-10-05', '0202-10-05', '1999-12-31', '2100-01-01']) {
            fireEvent.change(from, { target: { value: partial } });
            expect(from.value).toBe(partial);
        }
        fireEvent.blur(from);

        expect(onChange).not.toHaveBeenCalled();
        expect(from.value).toBe('2026-10-01');
    });

    it('takes the first and the last day that can be right', () => {
        const { onChange, from, to } = setup();

        fireEvent.change(from, { target: { value: '2000-01-01' } });
        fireEvent.change(to, { target: { value: '2099-12-31' } });

        expect(onChange).toHaveBeenNthCalledWith(1, 'from', '2000-01-01');
        expect(onChange).toHaveBeenNthCalledWith(2, 'to', '2099-12-31');
    });

    it('does not take an empty field unless it may be empty', () => {
        const { onChange, from } = setup();

        fireEvent.change(from, { target: { value: '' } });

        expect(onChange).not.toHaveBeenCalled();
        expect(from.value).toBe('');
    });

    it('reports an empty field when it may be empty', () => {
        const { onChange, from } = setup({ allowEmpty: true });

        fireEvent.change(from, { target: { value: '' } });

        expect(onChange).toHaveBeenCalledExactlyOnceWith('from', '');
    });

    it('shows a field that is empty', () => {
        const { from, to } = setup({ from: '', to: '', allowEmpty: true });

        expect(from.value).toBe('');
        expect(to.value).toBe('');
    });

    it('drops what was half typed when the days change from outside', () => {
        const { from, view } = setup();
        fireEvent.change(from, { target: { value: '0002-10-24' } });

        view.rerender(<DateRangeFields from="2026-09-01" to="2026-10-31" labels={labels} onChange={vi.fn()} />);

        expect(from.value).toBe('2026-09-01');
    });

    it('ties both fields to a message that is shown once, and marks them invalid', () => {
        const { from, to } = setup({ invalid: true, describedBy: 'problem' });

        for (const field of [from, to]) {
            expect(field.getAttribute('aria-describedby')).toBe('problem');
            expect(field.getAttribute('aria-invalid')).toBe('true');
        }
    });

    it('says valid when told so, and nothing when it is not told', () => {
        const valid = setup({ invalid: false });
        expect(valid.from.getAttribute('aria-invalid')).toBe('false');
        expect(valid.from.getAttribute('aria-describedby')).toBeNull();
        valid.view.unmount();

        const unknown = setup();
        expect(unknown.from.getAttribute('aria-invalid')).toBeNull();
    });

    it('only lets the browser offer the years that can be right', () => {
        const { from } = setup();

        expect([from.min, from.max]).toEqual(['2000-01-01', '2099-12-31']);
    });
});
