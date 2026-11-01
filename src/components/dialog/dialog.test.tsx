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
