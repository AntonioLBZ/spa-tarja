import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog } from './dialog';

function closeFromTheBrowser() {
    (screen.getByRole('dialog') as HTMLDialogElement).close();
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Dialog', () => {
    it('stays closed while it is not open', () => {
        render(
            <Dialog open={false} title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('is named by its title, a heading, and holds what it is given', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                <p>Body</p>
            </Dialog>
        );

        const dialog = screen.getByRole('dialog', { name: 'Moved' });
        expect(within(dialog).getByRole('heading', { name: 'Moved', level: 2 })).toBeDefined();
        expect(within(dialog).getByText('Body')).toBeDefined();
    });

    it('opens as a modal, which keeps the focus and the keyboard inside', () => {
        const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');

        render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        expect(showModal).toHaveBeenCalledTimes(1);
    });

    it('takes the focus itself when it opens, so no action shows a ring nobody asked for', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()} actions={<button type="button">Go</button>}>
                Body
            </Dialog>
        );

        expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });

    it('closes when the page stops asking for it, and opens again when it asks again', () => {
        const { rerender } = render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        rerender(
            <Dialog open={false} title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );
        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(
            <Dialog open title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );
        expect(screen.getByRole('dialog', { name: 'Moved' })).toBeDefined();
    });

    it('tells the page when the browser closes it, as Escape does', () => {
        const onClose = vi.fn();
        render(
            <Dialog open title="Moved" onClose={onClose}>
                Body
            </Dialog>
        );

        closeFromTheBrowser();

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('lets Escape cancel it', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );
        const cancel = new Event('cancel', { cancelable: true });

        screen.getByRole('dialog').dispatchEvent(cancel);

        expect(cancel.defaultPrevented).toBe(false);
    });

    it('stays open on Escape when it is told it cannot be dismissed', () => {
        render(
            <Dialog open title="Moved" dismissible={false} onClose={vi.fn()}>
                Body
            </Dialog>
        );
        const cancel = new Event('cancel', { cancelable: true });

        screen.getByRole('dialog').dispatchEvent(cancel);

        expect(cancel.defaultPrevented).toBe(true);
    });

    it('puts its actions apart, after what it holds', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()} actions={<button type="button">Go</button>}>
                Body
            </Dialog>
        );

        const dialog = screen.getByRole('dialog');
        const body = within(dialog).getByText('Body');
        const go = within(dialog).getByRole('button', { name: 'Go' });

        expect(body.contains(go)).toBe(false);
        expect(Boolean(body.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });

    it('leaves no room for actions when it has none', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        expect(screen.getByRole('dialog').querySelector('.dialog__actions')).toBeNull();
    });

    it('is a plain dialog unless it is a sheet', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        const dialog = screen.getByRole('dialog');

        expect(dialog.classList.contains('dialog')).toBe(true);
        expect(dialog.classList.contains('dialog--sheet')).toBe(false);
    });

    it('is a sheet when asked', () => {
        render(
            <Dialog open variant="sheet" title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        expect(screen.getByRole('dialog').classList.contains('dialog--sheet')).toBe(true);
    });

    it('has no close button without a label', () => {
        render(
            <Dialog open variant="sheet" title="Moved" onClose={vi.fn()}>
                Body
            </Dialog>
        );

        expect(within(screen.getByRole('dialog')).queryByRole('button')).toBeNull();
    });

    it('closes from its close button and tells the page', () => {
        const onClose = vi.fn();
        render(
            <Dialog open variant="sheet" title="Moved" closeLabel="Close" onClose={onClose}>
                Body
            </Dialog>
        );
        const dialog = screen.getByRole('dialog') as HTMLDialogElement;

        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(dialog.open).toBe(false);
    });

    it('puts the focus on what initialFocus returns', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()} initialFocus={() => screen.getByLabelText('Amount')}>
                <input aria-label="Amount" />
            </Dialog>
        );

        expect(document.activeElement).toBe(screen.getByLabelText('Amount'));
    });

    it('keeps the focus on itself when initialFocus returns nothing', () => {
        render(
            <Dialog open title="Moved" onClose={vi.fn()} initialFocus={() => null}>
                <input aria-label="Amount" />
            </Dialog>
        );

        expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });

    it('keeps its content in the page while it is closed', () => {
        render(
            <Dialog open={false} variant="sheet" title="Moved" onClose={vi.fn()}>
                <input aria-label="Amount" defaultValue="12" />
            </Dialog>
        );

        expect((screen.getByLabelText('Amount', { selector: 'input' }) as HTMLInputElement).value).toBe('12');
    });

    it('keeps its buttons working', () => {
        const onPress = vi.fn();
        render(
            <Dialog open title="Moved" onClose={vi.fn()}>
                <button type="button" onClick={onPress}>
                    Go
                </button>
            </Dialog>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Go' }));

        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
