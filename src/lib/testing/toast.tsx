import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { ToastProvider, useToast } from '@/components/toast/toast';

const root = document.documentElement;

const Harness = (props: { onAction?: () => void }) => {
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
            <button type="button" onClick={() => toast.show({ message: 'Saved Tea', icon: 'check' })}>
                Show done
            </button>
            <button type="button" onClick={() => toast.show({ message: 'Close to the limit' })}>
                Show plain
            </button>
            <button type="button" onClick={toast.dismiss}>
                Dismiss
            </button>
        </>
    );
};

const setup = (onAction?: () => void) => {
    render(
        <ToastProvider dismissLabel="Clear">
            <Harness onAction={onAction} />
        </ToastProvider>
    );
};

const show = (name = 'Show') => {
    fireEvent.click(screen.getByRole('button', { name }));
};

const elapse = (ms: number) => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

const toast = () => {
    return screen.queryByText('Deleted Lunch')?.closest('.toast') ?? null;
};

const swipe = (target: Element, dx: number, dy: number) => {
    const box = target.closest('.toast') ?? target;
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 60 } as DOMRect);
    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(target, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(target, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, isPrimary: true });
};

const PinHarness = (props: { onUpdate?: () => void; onLater?: () => void; onSwipeAway?: () => void }) => {
    const { onUpdate = () => undefined, onLater = () => undefined, onSwipeAway } = props;
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
                        onSwipeAway,
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
};

const setupPin = (props: { onUpdate?: () => void; onLater?: () => void; onSwipeAway?: () => void } = {}) => {
    return render(
        <ToastProvider dismissLabel="Clear">
            <PinHarness {...props} />
        </ToastProvider>
    );
};

const pinned = () => {
    return screen.queryByText('A new version is ready')?.closest('.toast') ?? null;
};

export { elapse, Harness, PinHarness, pinned, root, setup, setupPin, show, swipe, toast };
