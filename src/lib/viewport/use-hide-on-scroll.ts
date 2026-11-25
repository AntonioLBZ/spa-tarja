import { useEffect, useState, type RefObject } from 'react';

// How far the page has to move the other way before the answer changes, so a shaking hand doesn't flicker it
const TRAVEL = 8;

// Where the page is, held between its top and its end: the rubber band of iOS carries it past both and brings it back,
// and that is not a person scrolling
const position = () => {
    const end = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(Math.max(window.scrollY, 0), end);
};

// Whether the element at the top of the page is out of the way: after the page has gone down, until it comes up. It is
// never out of the way while the page is scrolled less than the element is tall.
const useHideOnScroll = (target: RefObject<HTMLElement | null>) => {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        let out = false;
        // Where the movement the other way would be counted from: the nearest to the top while the element is in, the
        // farthest down while it is out
        let pivot = position();

        const change = (next: boolean, top: number) => {
            out = next;
            pivot = top;
            setHidden(next);
        };

        const onScroll = () => {
            const top = position();

            if (top <= (target.current?.offsetHeight ?? 0)) {
                if (out) change(false, top);
                else pivot = top;
            } else if (out) {
                if (top > pivot) pivot = top;
                else if (pivot - top >= TRAVEL) change(false, top);
            } else if (top < pivot) {
                pivot = top;
            } else if (top - pivot >= TRAVEL) {
                change(true, top);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [target]);

    return hidden;
};

export { useHideOnScroll };
