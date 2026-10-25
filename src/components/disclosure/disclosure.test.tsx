import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Disclosure, DisclosurePanel } from './disclosure';

const toggle = () => screen.getByRole('button', { name: 'Details' });

describe('Disclosure', () => {
    it('starts closed, with a toggle that names what it opens and no panel to point at', () => {
        render(<Disclosure summary="Details">Hidden</Disclosure>);

        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(toggle().hasAttribute('aria-controls')).toBe(false);
        expect(screen.queryByText('Hidden')).toBeNull();
    });

    it('opens the panel under the toggle and ties them together', () => {
        render(<Disclosure summary="Details">Shown</Disclosure>);

        fireEvent.click(toggle());

        const panel = screen.getByText('Shown');
        expect(panel.classList.contains('disclosure__panel')).toBe(true);
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(toggle().getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.id).not.toBe('');
        expect(toggle().compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('closes again, taking the panel out of the page', () => {
        render(<Disclosure summary="Details">Shown</Disclosure>);
        fireEvent.click(toggle());

        fireEvent.click(toggle());

        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(toggle().hasAttribute('aria-controls')).toBe(false);
        expect(screen.queryByText('Shown')).toBeNull();
    });

    it('shows what the summary holds inside the toggle', () => {
        render(
            <Disclosure
                summary={
                    <>
                        <span>Rent</span>
                        <span>500</span>
                    </>
                }
            >
                Shown
            </Disclosure>
        );

        const button = screen.getByRole('button');
        expect(button.textContent).toBe('Rent500');
        expect(button.classList.contains('disclosure__toggle')).toBe(true);
        expect(button.getAttribute('type')).toBe('button');
    });

    it('can start open', () => {
        render(
            <Disclosure summary="Details" defaultOpen>
                Shown
            </Disclosure>
        );

        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Shown')).toBeTruthy();
    });

    it('tells who asked for the change', () => {
        const onOpenChange = vi.fn();
        render(
            <Disclosure summary="Details" onOpenChange={onOpenChange}>
                Shown
            </Disclosure>
        );

        fireEvent.click(toggle());
        fireEvent.click(toggle());

        expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('leaves the choice to the parent when it is told whether it is open', () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(
            <Disclosure summary="Details" open={false} onOpenChange={onOpenChange}>
                Shown
            </Disclosure>
        );

        fireEvent.click(toggle());

        expect(onOpenChange).toHaveBeenCalledWith(true);
        expect(screen.queryByText('Shown')).toBeNull();

        rerender(
            <Disclosure summary="Details" open onOpenChange={onOpenChange}>
                Shown
            </Disclosure>
        );

        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Shown')).toBeTruthy();

        fireEvent.click(toggle());

        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        expect(screen.getByText('Shown')).toBeTruthy();
    });

    it('does not open when it is disabled', () => {
        const onOpenChange = vi.fn();
        render(
            <Disclosure summary="Details" disabled onOpenChange={onOpenChange}>
                Shown
            </Disclosure>
        );

        fireEvent.click(toggle());

        expect((toggle() as HTMLButtonElement).disabled).toBe(true);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByText('Shown')).toBeNull();
    });

    describe('keepMounted', () => {
        it('keeps the panel in the page, hidden, while it is closed', () => {
            render(
                <Disclosure summary="Details" keepMounted>
                    <input aria-label="Name" />
                </Disclosure>
            );

            const panel = screen.getByLabelText('Name').closest('.disclosure__panel')!;
            expect(panel.hasAttribute('hidden')).toBe(true);
            expect(toggle().getAttribute('aria-expanded')).toBe('false');
            expect(toggle().hasAttribute('aria-controls')).toBe(false);
        });

        it('shows the panel when it opens, with what was typed still in it', () => {
            render(
                <Disclosure summary="Details" keepMounted defaultOpen>
                    <input aria-label="Name" />
                </Disclosure>
            );
            fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pets' } });

            fireEvent.click(toggle());
            fireEvent.click(toggle());

            const input = screen.getByLabelText('Name') as HTMLInputElement;
            expect(input.value).toBe('Pets');
            expect(input.closest('.disclosure__panel')!.hasAttribute('hidden')).toBe(false);
            expect(toggle().getAttribute('aria-controls')).toBe(input.closest('.disclosure__panel')!.id);
        });

        it('hides the panel from assistive technology while closed', () => {
            render(
                <Disclosure summary="Details" keepMounted>
                    <button type="button">Inside</button>
                </Disclosure>
            );

            expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull();
        });
    });

    it('hands the toggle to whoever needs to focus it', () => {
        const toggleRef = createRef<HTMLButtonElement>();
        render(
            <Disclosure summary="Details" toggleRef={toggleRef}>
                Shown
            </Disclosure>
        );

        expect(toggleRef.current).toBe(toggle());
    });

    it('has no chevron unless asked', () => {
        render(<Disclosure summary="Details">Shown</Disclosure>);

        expect(toggle().querySelector('svg')).toBeNull();
    });

    it('can end the toggle with a chevron, which is decoration', () => {
        render(
            <Disclosure summary="Details" chevron>
                Shown
            </Disclosure>
        );

        const chevron = toggle().querySelector('[data-icon="expand_more"]')!;
        expect(chevron.getAttribute('aria-hidden')).toBe('true');
        expect(toggle().textContent).toBe('Details');
    });

    it.each([
        ['div', 'DIV'],
        ['li', 'LI'],
        ['section', 'SECTION'],
    ] as const)('can be a %s', (as, tag) => {
        const { container } = render(
            <Disclosure as={as} summary="Details">
                Shown
            </Disclosure>
        );

        expect(container.firstElementChild!.tagName).toBe(tag);
        expect(container.firstElementChild!.classList.contains('disclosure')).toBe(true);
    });

    it('is a div unless told otherwise', () => {
        const { container } = render(<Disclosure summary="Details">Shown</Disclosure>);

        expect(container.firstElementChild!.tagName).toBe('DIV');
    });

    it('keeps the class the call site needs for its layout', () => {
        const { container } = render(
            <Disclosure className="category-row" summary="Details">
                Shown
            </Disclosure>
        );

        expect(container.firstElementChild!.className).toBe('disclosure category-row');
    });
});

describe('DisclosurePanel', () => {
    it('is the panel of a disclosure without the toggle', () => {
        render(<DisclosurePanel>Inside</DisclosurePanel>);

        const panel = screen.getByText('Inside');
        expect(panel.tagName).toBe('DIV');
        expect(panel.classList.contains('disclosure__panel')).toBe(true);
        expect(panel.hasAttribute('hidden')).toBe(false);
        expect(panel.hasAttribute('id')).toBe(false);
    });

    it('takes an id, a hidden state and the class of the call site', () => {
        render(
            <DisclosurePanel id="panel" hidden className="extra">
                Inside
            </DisclosurePanel>
        );

        const panel = document.getElementById('panel')!;
        expect(panel.hasAttribute('hidden')).toBe(true);
        expect(panel.className).toBe('disclosure__panel extra');
    });
});
