import { useEffect, useSyncExternalStore } from 'react';

type FocusSource = 'keyboard' | 'pointer';

const mark = (source: FocusSource) => {
    document.documentElement.dataset.focusSource = source;
};

const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') mark('keyboard');
};

const onPointerDown = () => mark('pointer');

// How the focus last moved, on the root as `data-focus-source`: a text field claims :focus-visible on a tap too, so a
// field shows the focus ring only when this says keyboard (ADR-0023)
const useFocusSource = () => {
    useEffect(() => {
        mark('pointer');
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('pointerdown', onPointerDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('pointerdown', onPointerDown, true);
            delete document.documentElement.dataset.focusSource;
        };
    }, []);
};

const subscribe = (onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributeFilter: ['data-focus-source'], attributes: true });
    return () => observer.disconnect();
};

const getSnapshot = () => document.documentElement.dataset.focusSource === 'keyboard';

// Whether the last move of the focus came from the keyboard, as it changes
const useKeyboardFocus = () => {
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

export { useFocusSource, useKeyboardFocus };
