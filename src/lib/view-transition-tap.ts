// Movement over this is a swipe, not a tap
const SLOP_PX = 10;

// While a view transition runs the browser sends every tap to the root, never to the live page. A tap ends the running
// transition at once and is then repeated on what is under it, so a link pressed during a slide or the ink of a theme
// opens without waiting for it. A finger that moved is a swipe and is left alone, even one that came back to where it
// started.
const endTransitionsOnTap = (): (() => void) => {
    let down: { x: number; y: number } | null = null;
    let moved = false;

    const onPointerDown = (event: PointerEvent) => {
        if (!event.isPrimary) return;
        down = { x: event.clientX, y: event.clientY };
        moved = false;
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!event.isPrimary || !down) return;
        moved ||= Math.hypot(event.clientX - down.x, event.clientY - down.y) > SLOP_PX;
    };

    const onPointerUp = (event: PointerEvent) => {
        const transition = document.activeViewTransition;
        const from = down;
        const wasMoved = moved;
        down = null;
        moved = false;
        if (!transition || !event.isPrimary || event.button !== 0) {
            return;
        }
        if (wasMoved || (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > SLOP_PX)) {
            return;
        }
        transition.skipTransition();
        const { clientX, clientY } = event;
        // Cancelable, or a link could not stop the browser from loading its address as a whole new page
        const repeat = () => {
            document
                .elementFromPoint(clientX, clientY)
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }));
        };
        transition.finished.then(repeat, repeat);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    return () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
    };
};

export { endTransitionsOnTap };
