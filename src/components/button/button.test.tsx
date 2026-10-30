import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
    it('does not submit the form around it unless it says so', () => {
        render(<Button>Save</Button>);

        expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
    });

    it('submits when it is told to', () => {
        render(<Button type="submit">Save</Button>);

        expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit');
    });

    it('is the plain look by default', () => {
        render(<Button>Save</Button>);

        const button = screen.getByRole('button', { name: 'Save' });
        expect(button.className).toBe('button');
    });

    it.each(['primary', 'danger'] as const)('takes the %s variant', (variant) => {
        render(<Button variant={variant}>Save</Button>);

        expect(screen.getByRole('button', { name: 'Save' }).className).toBe(`button button--${variant}`);
    });

    it('takes the ghost look, alone or with the danger variant', () => {
        render(
            <>
                <Button ghost>Edit</Button>
                <Button ghost variant="danger">
                    Delete
                </Button>
            </>
        );

        expect(screen.getByRole('button', { name: 'Edit' }).className).toBe('button button--ghost');
        expect(screen.getByRole('button', { name: 'Delete' }).className).toBe('button button--danger button--ghost');
    });

    it('fills its row when it is a block', () => {
        render(<Button block>Download</Button>);

        expect(screen.getByRole('button', { name: 'Download' }).className).toBe('button button--block');
    });

    it('draws a glyph in a box with even padding and is named by its label', () => {
        render(
            <Button glyph aria-label="Previous month">
                ←
            </Button>
        );

        const button = screen.getByRole('button', { name: 'Previous month' });
        expect(button.className).toBe('button button--glyph');
        expect(button.textContent).toBe('←');
    });

    it('asks a glyph for a name, since its text says nothing', () => {
        type Props = ComponentProps<typeof Button>;

        expectTypeOf<{ glyph: true; 'aria-label': string }>().toExtend<Props>();
        expectTypeOf<{ glyph: true }>().not.toExtend<Props>();
        expectTypeOf<{ glyph?: false }>().toExtend<Props>();
    });

    it('tells assistive technology when it is pressed', () => {
        render(
            <>
                <Button pressed>On</Button>
                <Button pressed={false}>Off</Button>
                <Button>Plain</Button>
            </>
        );

        const on = screen.getByRole('button', { name: 'On' });
        expect(on.getAttribute('aria-pressed')).toBe('true');
        expect(on.classList.contains('button--pressed')).toBe(true);
        const off = screen.getByRole('button', { name: 'Off' });
        expect(off.getAttribute('aria-pressed')).toBe('false');
        expect(off.classList.contains('button--pressed')).toBe(false);
        expect(screen.getByRole('button', { name: 'Plain' }).hasAttribute('aria-pressed')).toBe(false);
    });

    it('lets an aria-pressed of the call site win over the pressed state', () => {
        render(
            <>
                <Button aria-pressed="mixed">Some</Button>
                <Button pressed aria-pressed="mixed">
                    Some pressed
                </Button>
            </>
        );

        expect(screen.getByRole('button', { name: 'Some' }).getAttribute('aria-pressed')).toBe('mixed');
        const pressed = screen.getByRole('button', { name: 'Some pressed' });
        expect(pressed.getAttribute('aria-pressed')).toBe('mixed');
        expect(pressed.classList.contains('button--pressed')).toBe(true);
    });

    it('keeps the class of the call site next to its own', () => {
        render(
            <Button variant="danger" className="expense-item__delete">
                Delete
            </Button>
        );

        expect(screen.getByRole('button', { name: 'Delete' }).className).toBe(
            'button button--danger expense-item__delete'
        );
    });

    it('passes on what a button takes', () => {
        const onClick = vi.fn();
        const ref = createRef<HTMLButtonElement>();
        render(
            <>
                <Button ref={ref} onClick={onClick}>
                    Save
                </Button>
                <Button disabled>Off</Button>
            </>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(ref.current).toBe(screen.getByRole('button', { name: 'Save' }));
        expect((screen.getByRole('button', { name: 'Off' }) as HTMLButtonElement).disabled).toBe(true);
    });
});
