import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './toast';

const root = document.documentElement;

function Harness(props: { onAction?: () => void }) {
    const { onAction = () => undefined } = props;
    const toast = useToast();

    return (
        <>
            <button
                type="button"
                onClick={() => toast.show({ message: 'Deleted Lunch', action: { label: 'Undo', onAction } })}
            >
                Show
            </button>
            <button
                type="button"
                onClick={() => toast.show({ message: 'Deleted Coffee', action: { label: 'Undo', onAction } })}
            >
                Show another
            </button>
            <button type="button" onClick={() => toast.show({ message: 'Close to the limit' })}>
                Show plain
            </button>
            <button type="button" onClick={toast.dismiss}>
                Dismiss
            </button>
        </>
    );
}

function setup(onAction?: () => void) {
    render(
        <ToastProvider>
            <Harness onAction={onAction} />
        </ToastProvider>
    );
}

function show(name = 'Show') {
    fireEvent.click(screen.getByRole('button', { name }));
}

function elapse(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

function toast() {
    return screen.queryByText('Deleted Lunch')?.closest('.toast') ?? null;
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    root.style.removeProperty('--duration-base');
});

describe('Toast', () => {
    it('keeps an empty status region in the page from the start, so what comes in is announced', () => {
        setup();

        const region = screen.getByRole('status');
        expect(region.textContent).toBe('');

        show();

        expect(screen.getByRole('status')).toBe(region);
        expect(region.textContent).toContain('Deleted Lunch');
    });

    it('puts the message and a button with the action inside the region', () => {
        setup();

        show();

        const region = screen.getByRole('status');
        expect(region.querySelector('p')!.textContent).toBe('Deleted Lunch');
        const action = screen.getByRole('button', { name: 'Undo' });
        expect(region.contains(action)).toBe(true);
        expect(action.classList.contains('button')).toBe(true);
    });

    it('shows its action as a ghost, since the toast has its own edge', () => {
        setup();

        show();

        expect(screen.getByRole('button', { name: 'Undo' }).classList.contains('button--ghost')).toBe(true);
    });

    it('tells the bar of its edge how long it stays', () => {
        setup();

        show();

        expect((toast() as HTMLElement).style.getPropertyValue('--toast-duration')).toBe('8000ms');
    });

    it('is held while the pointer is over it, so the bar holds with the count', () => {
        setup();
        show();
        expect(toast()!.classList.contains('toast--held')).toBe(false);

        fireEvent.mouseEnter(toast()!);
        expect(toast()!.classList.contains('toast--held')).toBe(true);

        fireEvent.mouseLeave(toast()!);
        expect(toast()!.classList.contains('toast--held')).toBe(false);
    });

    it('is held while the focus is inside it, so the bar holds with the count', () => {
        setup();
        show();
        const action = screen.getByRole('button', { name: 'Undo' });

        act(() => action.focus());
        expect(toast()!.classList.contains('toast--held')).toBe(true);

        act(() => action.blur());
        expect(toast()!.classList.contains('toast--held')).toBe(false);
    });

    it('comes after the page in the document, so it is the last stop in the tab order', () => {
        setup();

        const region = screen.getByRole('status');
        const last = screen.getByRole('button', { name: 'Dismiss' });

        expect(last.compareDocumentPosition(region)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('can come without an action, with only its message, and still goes after 8 seconds', () => {
        setup();

        show('Show plain');

        const region = screen.getByRole('status');
        expect(region.textContent).toBe('Close to the limit');
        expect(within(region).queryByRole('button')).toBeNull();
        elapse(7_999);
        expect(screen.queryByText('Close to the limit')).not.toBeNull();
        elapse(1);
        expect(screen.queryByText('Close to the limit')).toBeNull();
    });

    it('closes with Escape when it has no action', () => {
        setup();
        show('Show plain');

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(screen.queryByText('Close to the limit')).toBeNull();
    });

    it('holds the count while the pointer is over it when it has no action', () => {
        setup();
        show('Show plain');
        elapse(5_000);

        fireEvent.mouseEnter(screen.getByText('Close to the limit').closest('.toast')!);
        elapse(60_000);

        expect(screen.queryByText('Close to the limit')).not.toBeNull();
    });

    it('runs the action and goes', () => {
        const onAction = vi.fn();
        setup(onAction);
        show();

        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

        expect(onAction).toHaveBeenCalledTimes(1);
        expect(toast()).toBeNull();
    });

    it('stays 8 seconds and then goes', () => {
        setup();
        show();

        elapse(7_999);
        expect(toast()).not.toBeNull();

        elapse(1);
        expect(toast()).toBeNull();
    });

    it('holds the count while the pointer is over it, and goes on with what was left', () => {
        setup();
        show();
        elapse(5_000);

        fireEvent.mouseEnter(toast()!);
        elapse(60_000);
        expect(toast()).not.toBeNull();

        fireEvent.mouseLeave(toast()!);
        elapse(2_999);
        expect(toast()).not.toBeNull();

        elapse(1);
        expect(toast()).toBeNull();
    });

    it('holds the count while the focus is inside it, and goes on with what was left', () => {
        setup();
        show();
        elapse(3_000);

        const action = screen.getByRole('button', { name: 'Undo' });
        act(() => action.focus());
        elapse(60_000);
        expect(toast()).not.toBeNull();

        act(() => action.blur());
        elapse(4_999);
        expect(toast()).not.toBeNull();

        elapse(1);
        expect(toast()).toBeNull();
    });

    it('closes with Escape', () => {
        setup();
        show();

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(toast()).toBeNull();
    });

    it('leaves Escape alone when a control that uses it took the key', () => {
        setup();
        show();
        const take = (event: Event) => event.preventDefault();
        document.addEventListener('keydown', take, true);

        fireEvent.keyDown(document.body, { key: 'Escape' });
        document.removeEventListener('keydown', take, true);

        expect(toast()).not.toBeNull();
    });

    it('ignores the other keys', () => {
        setup();
        show();

        fireEvent.keyDown(document.body, { key: 'Enter' });

        expect(toast()).not.toBeNull();
    });

    it('is replaced by the next one, which has the whole 8 seconds', () => {
        setup();
        show();
        elapse(6_000);

        show('Show another');

        expect(screen.queryByText('Deleted Lunch')).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
        elapse(7_999);
        expect(screen.getByText('Deleted Coffee')).toBeDefined();
        elapse(1);
        expect(screen.queryByText('Deleted Coffee')).toBeNull();
    });

    it('runs the action of the toast that is showing, not of the one it replaced', () => {
        const first = vi.fn();
        const second = vi.fn();
        function Two() {
            const { show: showToast } = useToast();
            return (
                <>
                    <button
                        type="button"
                        onClick={() => showToast({ message: 'First', action: { label: 'Undo', onAction: first } })}
                    >
                        One
                    </button>
                    <button
                        type="button"
                        onClick={() => showToast({ message: 'Second', action: { label: 'Undo', onAction: second } })}
                    >
                        Two
                    </button>
                </>
            );
        }
        render(
            <ToastProvider>
                <Two />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'One' }));
        fireEvent.click(screen.getByRole('button', { name: 'Two' }));
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('can be closed from outside', () => {
        setup();
        show();

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(toast()).toBeNull();
    });

    it('fades out before it goes, for as long as the transitions last', () => {
        root.style.setProperty('--duration-base', '200ms');
        setup();
        show();

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(toast()!.classList.contains('toast--leaving')).toBe(true);
        elapse(199);
        expect(toast()).not.toBeNull();
        elapse(1);
        expect(toast()).toBeNull();
    });

    it('turns the action off while it fades, so it cannot run twice', () => {
        root.style.setProperty('--duration-base', '200ms');
        setup();
        show();
        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
    });

    it('is replaced at once by a new one that comes while the old one fades', () => {
        root.style.setProperty('--duration-base', '200ms');
        setup();
        show();
        fireEvent.keyDown(document.body, { key: 'Escape' });

        show('Show another');

        expect(screen.queryByText('Deleted Lunch')).toBeNull();
        const coffee = screen.getByText('Deleted Coffee').closest('.toast')!;
        expect(coffee.classList.contains('toast--leaving')).toBe(false);
        elapse(500);
        expect(screen.getByText('Deleted Coffee')).toBeDefined();
    });

    it('needs its provider', () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => render(<Harness />)).toThrow('useToast needs a ToastProvider');
        quiet.mockRestore();
    });
});
