// While a view transition runs the browser sends every tap to the root, never to the live page. A tap ends the running
// transition at once and is then repeated on what is under it, so a link pressed during a slide or the ink of a theme
// opens without waiting for it.
const endTransitionsOnTap = (): (() => void) => {
    const onPointerUp = (event: PointerEvent) => {
        const transition = document.activeViewTransition;
        if (!transition || !event.isPrimary || event.button !== 0) {
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
    document.addEventListener('pointerup', onPointerUp, true);
    return () => document.removeEventListener('pointerup', onPointerUp, true);
};

export { endTransitionsOnTap };
