import { useEffect, type RefObject } from 'react';

import { DURATION, EASE, MOTION_QUERY, canAnimate, gsap, useGSAP } from './gsap';

interface GlideOptions {
    // The box the mark moves inside, which must be positioned
    track: RefObject<HTMLElement | null>;
    // The one mark that follows the chosen element: drawn by the script, and absolute at the corner of the track
    mark: RefObject<HTMLElement | null>;
    // Finds the element the mark covers, inside the track; none hides the mark
    selector: string;
    // What the mark follows: it glides when this changes
    follows: string | undefined;
}

// Where the target sits inside the track, which is where an absolute mark is placed
const measure = (track: HTMLElement, selector: string) => {
    const target = track.querySelector<HTMLElement>(selector);
    if (!target) return null;
    const box = track.getBoundingClientRect();
    const at = target.getBoundingClientRect();
    return {
        x: at.left - box.left - track.clientLeft,
        y: at.top - box.top - track.clientTop,
        width: at.width,
        height: at.height,
    };
};

// A mark that glides from the chosen element to the next, stretching over both on the way, and follows the track when
// its size changes, like a scrollbar coming in. Without motion it only sits under the chosen one, and where scripts
// can't run the elements draw their own state: `data-glide` on the track says the mark is the one drawing it.
const useGlide = (options: GlideOptions) => {
    const { track, mark, selector, follows } = options;

    useGSAP(
        () => {
            const box = track.current;
            const dot = mark.current;
            if (!box || !dot || !canAnimate()) return;
            const to = measure(box, selector);
            if (!to) {
                gsap.set(dot, { autoAlpha: 0 });
                return;
            }
            box.setAttribute('data-glide', '');

            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                // Not drawn yet, or put back by a revert: it appears in place, with no trip from where it was
                if (Number(gsap.getProperty(dot, 'opacity')) === 0) {
                    gsap.set(dot, { ...to, autoAlpha: 1 });
                    return;
                }
                const from = { x: Number(gsap.getProperty(dot, 'x')), width: Number(gsap.getProperty(dot, 'width')) };
                const reach = Math.min(from.x, to.x);
                const span = Math.abs(to.x - from.x) + to.width;
                gsap.timeline()
                    .to(dot, { x: reach, width: span, duration: DURATION.fast, ease: EASE.standard })
                    .to(dot, { ...to, duration: DURATION.slow, ease: EASE.enter });
            });
            mm.add(`not all and ${MOTION_QUERY}`, () => {
                gsap.set(dot, { ...to, autoAlpha: 1 });
            });
            return () => mm.revert();
        },
        { dependencies: [follows, selector] }
    );

    useEffect(() => {
        const box = track.current;
        const dot = mark.current;
        if (!box || !dot || !canAnimate() || typeof ResizeObserver === 'undefined') return;
        const follow = () => {
            const to = measure(box, selector);
            if (to) gsap.set(dot, to);
        };
        const watcher = new ResizeObserver(follow);
        watcher.observe(box);
        return () => watcher.disconnect();
    }, [track, mark, selector]);
};

export { useGlide, type GlideOptions };
