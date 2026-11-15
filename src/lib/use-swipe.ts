import { useEffect, useEffectEvent, type RefObject } from 'react';

import type { SwipeDirection } from './route-transition';

// Left free at each side of the screen for the back gesture of the system
const EDGE_PX = 24;
// Movement under this is still a tap
const SLOP_PX = 10;
// A swipe goes this share of the width, or flicks this far at this speed (px per ms)
const DISTANCE_SHARE = 0.3;
const FLICK_PX = 48;
const FLICK_SPEED = 0.4;
// The speed of a flick is read over the last moments of the stroke
const FLICK_WINDOW_MS = 100;
// The click a browser may still send at the end of a swipe is swallowed for this long
const CLICK_GUARD_MS = 400;

// What a swipe never starts on: a control that takes a drag or the text, a dialog, and what asks for none
const KEEPS_THE_DRAG = 'input, textarea, select, [contenteditable], dialog, [data-no-swipe]';

// A swipe under way: it follows the finger, from 0 (where it started) to 1 (a whole screen across), and is let go of
// either to go on or to go back
interface SwipeDrag {
    follow: (progress: number) => void;
    release: (go: boolean) => void;
}

interface Sample {
    x: number;
    at: number;
}

interface Stroke {
    pointerId: number;
    x: number;
    y: number;
    at: number;
    samples: Sample[];
    direction: SwipeDirection | null;
    drag: SwipeDrag | null;
}

// Something between the start of the touch and the area that scrolls sideways keeps the drag for itself
const scrollsSideways = (from: Element, area: Element) => {
    for (let element: Element | null = from; element && element !== area; element = element.parentElement) {
        const { overflowX } = getComputedStyle(element);
        if ((overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth) return true;
    }
    return false;
};

const directionOf = (dx: number): SwipeDirection => (dx < 0 ? 'next' : 'previous');

// How far the finger has gone the way of the swipe, as a share of the screen
const progressOf = (dx: number, direction: SwipeDirection) => {
    const along = direction === 'next' ? -dx : dx;
    return Math.min(Math.max(along / window.innerWidth, 0), 1);
};

// The speed of the finger the way of the swipe at its end, in px per ms
const speedOf = (samples: readonly Sample[], direction: SwipeDirection) => {
    const last = samples.at(-1);
    const first = samples.find((sample) => last && last.at - sample.at <= FLICK_WINDOW_MS);
    if (!last || !first) return 0;
    const speed = (last.x - first.x) / Math.max(last.at - first.at, 1);
    return direction === 'next' ? -speed : speed;
};

// The finger crossed the screen far enough, or flicked it, the way of the swipe
const goesOn = (dx: number, stroke: Stroke, direction: SwipeDirection) => {
    const along = direction === 'next' ? -dx : dx;
    const speed = speedOf(stroke.samples, direction);
    if (speed < -FLICK_SPEED) return false;
    if (along >= window.innerWidth * DISTANCE_SHARE) return true;
    return along >= FLICK_PX && speed >= FLICK_SPEED;
};

// A swipe of a finger across the area: to the left it asks for the next screen, to the right for the previous one.
// `begin` is asked once the finger is clearly going sideways, and what it gives follows the finger until it lifts.
// While a view transition runs the browser sends the touch to the root, so a touch there counts too.
const useSwipe = (
    area: RefObject<HTMLElement | null>,
    begin: (direction: SwipeDirection) => SwipeDrag | undefined,
    on: boolean
) => {
    const start = useEffectEvent(begin);

    useEffect(() => {
        if (!on) return;
        let stroke: Stroke | null = null;
        let guardUntil = 0;

        const startsHere = (target: EventTarget | null) => {
            const box = area.current;
            if (!box || !(target instanceof Element)) return false;
            if (target === document.documentElement) return document.activeViewTransition != null;
            if (!box.contains(target) || target.closest(KEEPS_THE_DRAG)) return false;
            return !scrollsSideways(target, box);
        };

        const onDown = (event: PointerEvent) => {
            stroke?.drag?.release(false);
            stroke = null;
            if (!event.isPrimary || event.pointerType !== 'touch' || !startsHere(event.target)) return;
            if (event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX) return;
            const { pointerId, clientX: x, clientY: y, timeStamp: at } = event;
            stroke = { pointerId, x, y, at, samples: [{ x, at }], direction: null, drag: null };
        };

        const onMove = (event: PointerEvent) => {
            if (stroke?.pointerId !== event.pointerId) return;
            const dx = event.clientX - stroke.x;
            const dy = event.clientY - stroke.y;
            stroke.samples.push({ x: event.clientX, at: event.timeStamp });
            if (stroke.direction === null) {
                if (Math.abs(dy) > SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
                    stroke = null;
                    return;
                }
                if (Math.abs(dx) <= SLOP_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
                stroke.direction = directionOf(dx);
                stroke.drag = start(stroke.direction) ?? null;
                if (!stroke.drag) {
                    stroke = null;
                    return;
                }
            }
            stroke.drag?.follow(progressOf(dx, stroke.direction));
        };

        const onUp = (event: PointerEvent) => {
            if (stroke?.pointerId !== event.pointerId) return;
            const ended = stroke;
            stroke = null;
            const dx = event.clientX - ended.x;
            const dy = event.clientY - ended.y;
            ended.samples.push({ x: event.clientX, at: event.timeStamp });
            if (Math.abs(dx) > SLOP_PX) guardUntil = event.timeStamp + CLICK_GUARD_MS;
            if (ended.direction !== null) {
                ended.drag?.release(goesOn(dx, ended, ended.direction));
                return;
            }
            // A swipe so quick that no movement came between its ends
            if (Math.abs(dx) < 2 * Math.abs(dy)) return;
            const direction = directionOf(dx);
            if (goesOn(dx, ended, direction)) start(direction)?.release(true);
        };

        const onCancel = (event: PointerEvent) => {
            if (stroke?.pointerId !== event.pointerId) return;
            stroke.drag?.release(false);
            stroke = null;
        };

        const onClick = (event: MouseEvent) => {
            if (event.timeStamp > guardUntil) return;
            guardUntil = 0;
            event.preventDefault();
            event.stopPropagation();
        };

        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', onCancel, true);
        document.addEventListener('click', onClick, true);
        return () => {
            stroke?.drag?.release(false);
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointermove', onMove, true);
            document.removeEventListener('pointerup', onUp, true);
            document.removeEventListener('pointercancel', onCancel, true);
            document.removeEventListener('click', onClick, true);
        };
    }, [area, on]);
};

export { useSwipe, type SwipeDrag };
