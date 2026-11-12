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
        <ToastProvider dismissLabel="Clear">
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
        expect(
            within(region)
                .getAllByRole('button')
                .map((button) => button.getAttribute('aria-label'))
        ).toEqual(['Clear']);
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
            <ToastProvider dismissLabel="Dismiss">
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

    describe('its dismiss button', () => {
        it('ends a toast that goes away by itself, after its action, named by the label it was given', () => {
            setup();

            show();

            const region = screen.getByRole('status');
            const buttons = within(region).getAllByRole('button');
            expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
                'Undo',
                'Clear',
            ]);
            const dismiss = buttons[1]!;
            expect(dismiss.classList.contains('button--ghost')).toBe(true);
            expect(dismiss.classList.contains('button--glyph')).toBe(true);
            expect(dismiss.querySelector('svg')!.getAttribute('data-icon')).toBe('close');
            expect(dismiss.textContent).toBe('');
        });

        it('is on a toast with no action too, as the only button', () => {
            setup();

            show('Show plain');

            expect(within(screen.getByRole('status')).getAllByRole('button')).toHaveLength(1);
            expect(screen.getByRole('button', { name: 'Clear' })).toBeDefined();
        });

        it('clears the toast away without running its action', () => {
            const onAction = vi.fn();
            setup(onAction);
            show();

            fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

            expect(toast()).toBeNull();
            expect(onAction).not.toHaveBeenCalled();
        });

        it('lets the next toast come with its own button after the first was cleared', () => {
            setup();
            show();
            fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

            show('Show another');

            expect(screen.getByText('Deleted Coffee')).toBeDefined();
            expect(screen.getAllByRole('button', { name: 'Clear' })).toHaveLength(1);
        });

        it('is turned off while the toast fades, as the action is', () => {
            root.style.setProperty('--duration-base', '200ms');
            setup();
            show();
            act(() => screen.getByRole('button', { name: 'Clear' }).click());

            expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true);
            elapse(200);
            expect(toast()).toBeNull();
        });
    });

    it('needs its provider', () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => render(<Harness />)).toThrow('useToast needs a ToastProvider');
        quiet.mockRestore();
    });
});

function PinHarness(props: { onUpdate?: () => void; onLater?: () => void }) {
    const { onUpdate = () => undefined, onLater = () => undefined } = props;
    const toast = useToast();

    return (
        <>
            <button
                type="button"
                onClick={() =>
                    toast.pin({
                        message: 'A new version is ready',
                        actions: [
                            { label: 'Update', onAction: onUpdate },
                            { label: 'Later', onAction: onLater },
                        ],
                    })
                }
            >
                Pin
            </button>
            <button
                type="button"
                onClick={() =>
                    toast.pin({ message: 'Another version', actions: [{ label: 'Go', onAction: onUpdate }] })
                }
            >
                Pin another
            </button>
            <button type="button" onClick={toast.unpin}>
                Unpin
            </button>
            <button type="button" onClick={() => toast.show({ message: 'Deleted Lunch' })}>
                Show
            </button>
        </>
    );
}

function setupPin(props: { onUpdate?: () => void; onLater?: () => void } = {}) {
    render(
        <ToastProvider dismissLabel="Clear">
            <PinHarness {...props} />
        </ToastProvider>
    );
}

function pinned() {
    return screen.queryByText('A new version is ready')?.closest('.toast') ?? null;
}

describe('a pinned Toast', () => {
    it('has no dismiss button: its answers close it', () => {
        setupPin();

        show('Pin');

        expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
        expect(within(screen.getByRole('status')).getAllByRole('button')).toHaveLength(2);
    });

    it('holds its message and one ghost action for each of its answers', () => {
        setupPin();

        show('Pin');

        const region = screen.getByRole('status');
        expect(region.textContent).toContain('A new version is ready');
        for (const name of ['Update', 'Later']) {
            const action = screen.getByRole('button', { name });
            expect(region.contains(action)).toBe(true);
            expect(action.classList.contains('button--ghost')).toBe(true);
        }
    });

    it('has no bar and no count: it stays until it is answered', () => {
        setupPin();

        show('Pin');

        expect(pinned()!.classList.contains('toast--pinned')).toBe(true);
        elapse(10 * 60_000);
        expect(pinned()).not.toBeNull();
    });

    it('goes with the action that answers it, after running it', () => {
        const onLater = vi.fn();
        setupPin({ onLater });
        show('Pin');

        fireEvent.click(screen.getByRole('button', { name: 'Later' }));

        expect(onLater).toHaveBeenCalledTimes(1);
        expect(pinned()).toBeNull();
    });

    it('goes when it is taken away', () => {
        setupPin();
        show('Pin');

        fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));

        expect(pinned()).toBeNull();
    });

    it('is not closed by Escape', () => {
        setupPin();
        show('Pin');

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(pinned()).not.toBeNull();
    });

    it('sits above the toast that goes away by itself, which does not replace it', () => {
        setupPin();
        show('Pin');

        show('Show');

        const region = screen.getByRole('status');
        const boxes = Array.from(region.querySelectorAll('.toast'));
        expect(boxes.map((box) => box.querySelector('p')!.textContent)).toEqual([
            'A new version is ready',
            'Deleted Lunch',
        ]);
        elapse(8_000);
        expect(screen.queryByText('Deleted Lunch')).toBeNull();
        expect(pinned()).not.toBeNull();
    });

    it('is not replaced by a toast that comes after it, and replaces only another pinned one', () => {
        setupPin();
        show('Pin');
        show('Show');
        expect(pinned()).not.toBeNull();

        show('Pin another');

        expect(pinned()).toBeNull();
        expect(screen.getByText('Another version')).toBeDefined();
        expect(screen.getAllByRole('button', { name: 'Go' })).toHaveLength(1);
    });

    it('keeps its box when it is pinned again with the same kind of content, so it does not come in twice', () => {
        setupPin();
        show('Pin');
        const box = pinned();

        show('Pin');

        expect(pinned()).toBe(box);
    });

    it('fades out before it goes, for as long as the transitions last', () => {
        root.style.setProperty('--duration-base', '200ms');
        setupPin();
        show('Pin');

        show('Unpin');

        expect(pinned()!.classList.contains('toast--leaving')).toBe(true);
        elapse(199);
        expect(pinned()).not.toBeNull();
        elapse(1);
        expect(pinned()).toBeNull();
    });
});
