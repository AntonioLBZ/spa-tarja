import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field, type FieldControl } from './field';

function input(control: FieldControl) {
    return <input {...control} type="text" />;
}

describe('Field', () => {
    it('ties the label to the control', () => {
        render(<Field label="Amount">{input}</Field>);

        const control = screen.getByLabelText('Amount');
        expect(control.tagName).toBe('INPUT');
        expect(screen.getByText('Amount').tagName).toBe('LABEL');
    });

    it('lays out the label, the control, the hint and the error in that order', () => {
        const { container } = render(
            <Field label="Amount" hint="Digits only" error="Not a number">
                {input}
            </Field>
        );

        const field = container.firstElementChild!;
        expect(field.classList.contains('field')).toBe(true);
        expect([...field.children].map((child) => child.tagName)).toEqual(['LABEL', 'INPUT', 'P', 'P']);
        expect(field.children[2]!.classList.contains('field__hint')).toBe(true);
        expect(field.children[3]!.classList.contains('notice--danger')).toBe(true);
    });

    it('gives every field an id of its own', () => {
        render(
            <>
                <Field label="First">{input}</Field>
                <Field label="Second">{input}</Field>
            </>
        );

        expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
    });

    it('wraps a whole row of controls and ties the label to the one that takes the id', () => {
        render(
            <Field label="Income">
                {(control) => (
                    <div>
                        <input {...control} type="text" />
                        <button type="submit">Save</button>
                    </div>
                )}
            </Field>
        );

        expect(screen.getByLabelText('Income').tagName).toBe('INPUT');
        expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    });

    it('works with a select', () => {
        render(
            <Field label="Payment">
                {(control) => (
                    <select {...control}>
                        <option>Cash</option>
                    </select>
                )}
            </Field>
        );

        expect(screen.getByLabelText('Payment').tagName).toBe('SELECT');
    });

    describe('hint', () => {
        it('is a paragraph that describes the control', () => {
            render(
                <Field label="Category" hint="Suggested">
                    {input}
                </Field>
            );

            const hint = screen.getByText('Suggested');
            expect(hint.tagName).toBe('P');
            expect(screen.getByLabelText('Category').getAttribute('aria-describedby')).toBe(hint.id);
            expect(hint.id).not.toBe('');
        });

        it('is left out when there is none', () => {
            const { container } = render(<Field label="Amount">{input}</Field>);

            expect(container.querySelector('.field__hint')).toBeNull();
            expect(screen.getByLabelText('Amount').hasAttribute('aria-describedby')).toBe(false);
        });
    });

    describe('error', () => {
        it('is an alert that describes the control and marks it invalid', () => {
            render(
                <Field label="Amount" error="Not a number">
                    {input}
                </Field>
            );

            const alert = screen.getByRole('alert');
            expect(alert.textContent).toBe('Not a number');
            expect(alert.id).not.toBe('');
            const control = screen.getByLabelText('Amount');
            expect(control.getAttribute('aria-describedby')).toBe(alert.id);
            expect(control.getAttribute('aria-invalid')).toBe('true');
        });

        it('shows nothing while there is no problem, and the control says it is valid', () => {
            render(
                <Field label="Amount" error={null}>
                    {input}
                </Field>
            );

            expect(screen.queryByRole('alert')).toBeNull();
            const control = screen.getByLabelText('Amount');
            expect(control.getAttribute('aria-invalid')).toBe('false');
            expect(control.hasAttribute('aria-describedby')).toBe(false);
        });

        it('leaves the validity alone for a control that cannot be invalid', () => {
            render(<Field label="Amount">{input}</Field>);

            expect(screen.getByLabelText('Amount').hasAttribute('aria-invalid')).toBe(false);
        });

        it('treats false as no problem too', () => {
            render(
                <Field label="Amount" error={false}>
                    {input}
                </Field>
            );

            expect(screen.queryByRole('alert')).toBeNull();
            expect(screen.getByLabelText('Amount').getAttribute('aria-invalid')).toBe('false');
        });
    });

    describe('describedBy', () => {
        it('points at an element outside the field', () => {
            render(
                <>
                    <Field label="Part" describedBy="shared-problem">
                        {input}
                    </Field>
                    <p id="shared-problem">Something is wrong</p>
                </>
            );

            expect(screen.getByLabelText('Part').getAttribute('aria-describedby')).toBe('shared-problem');
        });

        it('comes after the hint and the error', () => {
            render(
                <Field label="Part" hint="Hint" error="Error" describedBy="shared-problem">
                    {input}
                </Field>
            );

            const ids = screen.getByLabelText('Part').getAttribute('aria-describedby')!.split(' ');
            expect(ids).toEqual([screen.getByText('Hint').id, screen.getByRole('alert').id, 'shared-problem']);
        });
    });

    it('keeps the class the call site needs for its layout', () => {
        const { container } = render(
            <Field className="grow" label="Amount">
                {input}
            </Field>
        );

        const field = container.firstElementChild!;
        expect(field.classList.contains('field')).toBe(true);
        expect(field.classList.contains('grow')).toBe(true);
    });
});
