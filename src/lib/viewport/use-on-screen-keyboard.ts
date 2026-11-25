import { useEffect } from 'react';

// What the visual viewport has to lose to count as an on-screen keyboard, so a bar of the browser doesn't
const KEYBOARD_MIN = 150;

// Says on the root, as `data-keyboard="open"`, while an on-screen keyboard covers the page, read from the visual
// viewport and never from the focus: a phone may close the keyboard and leave the focus in the field
const useOnScreenKeyboard = () => {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        const root = document.documentElement;
        const update = () => {
            const covered = window.innerHeight - viewport.height * viewport.scale;
            if (covered > KEYBOARD_MIN) root.dataset.keyboard = 'open';
            else delete root.dataset.keyboard;
        };

        update();
        viewport.addEventListener('resize', update);

        return () => {
            viewport.removeEventListener('resize', update);
            delete root.dataset.keyboard;
        };
    }, []);
};

export { useOnScreenKeyboard };
