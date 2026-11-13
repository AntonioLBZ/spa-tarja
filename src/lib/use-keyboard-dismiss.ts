import { useEffect } from 'react';

// What the visual viewport has to lose to count as an on-screen keyboard, so a bar of the browser doesn't
const KEYBOARD_MIN = 150;

const isTextField = (element: Element | null): element is HTMLElement =>
    element instanceof HTMLInputElement
        ? !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(element.type)
        : element instanceof HTMLTextAreaElement;

// Blurs the focused text field when the on-screen keyboard goes away, since a phone may close the keyboard (the back
// button of Android) and leave the focus where it was, and the bottom bar returns only when no field has it
const useKeyboardDismiss = () => {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        const covered = () => window.innerHeight - viewport.height * viewport.scale;
        let open = covered() > KEYBOARD_MIN;

        const onResize = () => {
            const next = covered() > KEYBOARD_MIN;
            if (open && !next && isTextField(document.activeElement)) document.activeElement.blur();
            open = next;
        };

        viewport.addEventListener('resize', onResize);

        return () => viewport.removeEventListener('resize', onResize);
    }, []);
};

export { useKeyboardDismiss };
