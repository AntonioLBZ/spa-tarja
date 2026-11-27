import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from '@/components/toast/toast';
import { elapse, Harness, root, setup, show, swipe, toast } from '@/lib/testing/toast';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    root.style.removeProperty('--duration-base');
});

describe('Toast', () => {
    it('puts a bare mark in front of the message when it reports something done', () => {
        setup();

        show('Show done');

        const box = screen.getByText('Saved Tea').closest('.toast') as HTMLElement;
        expect(box.firstElementChild?.className).toContain('toast__mark');
        expect(box.querySelector('.toast__mark svg')?.getAttribute('data-icon')).toBe('check');
    });

    it('has no mark when it only warns', () => {
        setup();

        show('Show plain');

        expect(document.querySelector('.toast__mark')).toBeNull();
    });

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

    it('holds the count and its bar while the pointer is over it, and goes on with what was left', () => {
        setup();
        show();
        elapse(5_000);
        expect(toast()!.classList.contains('toast--held')).toBe(false);

        fireEvent.mouseEnter(toast()!);
        elapse(60_000);
        expect(toast()).not.toBeNull();
        expect(toast()!.classList.contains('toast--held')).toBe(true);

        fireEvent.mouseLeave(toast()!);
        expect(toast()!.classList.contains('toast--held')).toBe(false);
        elapse(2_999);
        expect(toast()).not.toBeNull();

        elapse(1);
        expect(toast()).toBeNull();
    });

    it('holds the count and its bar while the focus is inside it, and goes on with what was left', () => {
        setup();
        show();
        elapse(3_000);

        const action = screen.getByRole('button', { name: 'Undo' });
        act(() => action.focus());
        elapse(60_000);
        expect(toast()).not.toBeNull();
        expect(toast()!.classList.contains('toast--held')).toBe(true);

        act(() => action.blur());
        expect(toast()!.classList.contains('toast--held')).toBe(false);
        elapse(4_999);
        expect(toast()).not.toBeNull();

        elapse(1);
        expect(toast()).toBeNull();
    });

    describe('while the last input came from the keyboard', () => {
        async function typing() {
            await act(async () => {
                root.dataset.focusSource = 'keyboard';
            });
        }

        async function pointing() {
            await act(async () => {
                root.dataset.focusSource = 'pointer';
            });
        }

        afterEach(() => {
            delete root.dataset.focusSource;
        });

        it('stays past 8 seconds when it offers an action, and its bar does not drain', async () => {
            await typing();
            setup();
            show();

            elapse(60_000);

            expect(toast()).not.toBeNull();
            expect(toast()!.classList.contains('toast--kept')).toBe(true);
        });

        it('stays while the keyboard is used even if it came in before the keyboard was', async () => {
            setup();
            show();
            elapse(5_000);

            await typing();
            elapse(60_000);

            expect(toast()).not.toBeNull();
        });

        it('counts its whole time from the moment the pointer is used again', async () => {
            await typing();
            setup();
            show();
            elapse(30_000);

            await pointing();
            expect(toast()!.classList.contains('toast--kept')).toBe(false);
            elapse(7_999);
            expect(toast()).not.toBeNull();

            elapse(1);
            expect(toast()).toBeNull();
        });

        it('still goes after 8 seconds when it has no action to answer', async () => {
            await typing();
            setup();
            show('Show plain');

            elapse(8_000);

            expect(screen.queryByText('Close to the limit')).toBeNull();
        });

        it('is closed by Escape, by its dismiss button and by its action', async () => {
            await typing();
            setup();
            show();
            fireEvent.keyDown(document.body, { key: 'Escape' });
            expect(toast()).toBeNull();

            show();
            fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
            expect(toast()).toBeNull();

            show();
            fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
            expect(toast()).toBeNull();
        });

        it('is replaced by the next toast, which stays too', async () => {
            await typing();
            setup();
            show();

            show('Show another');
            elapse(60_000);

            expect(screen.queryByText('Deleted Lunch')).toBeNull();
            expect(screen.getByText('Deleted Coffee')).toBeDefined();
        });
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

    describe('swiped', () => {
        it('goes when it is swiped to a side by more than a third of its width', () => {
            setup();
            show();

            swipe(toast()!, -120, 3);

            expect(toast()).toBeNull();
        });

        it('goes when it is swiped down by more than half its height', () => {
            setup();
            show();

            swipe(toast()!, 2, 40);

            expect(toast()).toBeNull();
        });

        it('goes at once where it was let go, with no fade', () => {
            root.style.setProperty('--duration-base', '200ms');
            setup();
            show();

            swipe(toast()!, 2, 150);

            expect(toast()).toBeNull();
        });

        it('stays when it is swiped up, the way it never goes', () => {
            setup();
            show();

            swipe(toast()!, 2, -80);

            expect(toast()).not.toBeNull();
        });

        it('comes back when the swipe is shorter', () => {
            setup();
            show();

            swipe(toast()!, 60, 2);

            expect(toast()).not.toBeNull();
            expect((toast() as HTMLElement).style.getPropertyValue('--swipe-x')).toBe('');
        });

        it('runs no action when the swipe started on it', () => {
            const onAction = vi.fn();
            setup(onAction);
            show();
            const undo = within(toast() as HTMLElement).getByRole('button', { name: 'Undo' });

            swipe(undo, 40, 2);
            fireEvent.click(undo);

            expect(onAction).not.toHaveBeenCalled();
            expect(toast()).not.toBeNull();
        });

        it('holds the count while it is dragged', () => {
            setup();
            show();
            const box = toast()!;

            fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true });
            fireEvent.pointerMove(box, { clientX: 100, clientY: 130, pointerId: 1, isPrimary: true });
            elapse(9_000);

            expect(toast()).not.toBeNull();
            expect(box.className).toContain('toast--held');
        });
    });

    it('needs its provider', () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => render(<Harness />)).toThrow('useToast needs a ToastProvider');
        quiet.mockRestore();
    });
});
