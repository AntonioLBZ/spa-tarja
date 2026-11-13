import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field, FieldBox, type FieldControl } from './field';

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

    it('puts the label and the control in a box, and the hint and the error under it', () => {
        const { container } = render(
            <Field label="Amount" hint="Digits only" error="Not a number">
                {input}
            </Field>
        );

        const field = container.firstElementChild!;
        expect(field.classList.contains('field')).toBe(true);
        expect([...field.children].map((child) => child.tagName)).toEqual(['DIV', 'P', 'P']);
        const box = field.children[0]!;
        expect(box.classList.contains('field__box')).toBe(true);
        expect([...box.children].map((child) => child.tagName)).toEqual(['LABEL', 'INPUT']);
        expect(field.children[1]!.classList.contains('field__hint')).toBe(true);
        expect(field.children[2]!.classList.contains('notice--danger')).toBe(true);
    });

    it('gives the control a blank placeholder, so the label can tell an empty field from a filled one', () => {
        render(<Field label="Amount">{input}</Field>);

        expect(screen.getByLabelText('Amount').getAttribute('placeholder')).toBe(' ');
    });

    it('draws an icon inside the box, before the control, hidden from assistive technology', () => {
        const { container } = render(
            <Field label="Search" icon={<svg data-testid="glass" />}>
                {input}
            </Field>
        );

        const box = container.querySelector('.field__box')!;
        const icon = box.querySelector('.field__icon')!;
        expect(icon.getAttribute('aria-hidden')).toBe('true');
        expect(icon.querySelector('[data-testid="glass"]')).not.toBeNull();
        expect(box.classList.contains('field__box--icon')).toBe(true);
        expect(screen.getByLabelText('Search').tagName).toBe('INPUT');
    });

    it('puts its actions beside the box, outside it', () => {
        const { container } = render(
            <Field label="Income" actions={<button type="submit">Save</button>}>
                {input}
            </Field>
        );

        const row = container.querySelector('.field__row')!;
        expect([...row.children].map((child) => child.tagName)).toEqual(['DIV', 'BUTTON']);
        expect(row.querySelector('.field__box button')).toBeNull();
        expect(screen.getByLabelText('Income').closest('.field__box')).not.toBeNull();
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

describe('FieldBox', () => {
    it('draws the box of a field around a control that is named elsewhere', () => {
        const { container } = render(
            <FieldBox>
                <input aria-label="Part of Ana" type="text" />
            </FieldBox>
        );

        const box = container.firstElementChild!;
        expect(box.classList.contains('field__box')).toBe(true);
        expect(box.querySelector('label')).toBeNull();
        expect(screen.getByLabelText('Part of Ana').parentElement).toBe(box);
    });
});
