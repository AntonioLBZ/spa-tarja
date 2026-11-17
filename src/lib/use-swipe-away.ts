import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

type SwipeSide = 'left' | 'right' | 'up' | 'down';

interface SwipeAwayOptions {
    // The sides the box can be swiped away to
    sides: readonly SwipeSide[];
    onAway: (side: SwipeSide) => void;
    on?: boolean;
}

interface Stroke {
    x: number;
    y: number;
    axis: 'x' | 'y' | null;
}

// A move shorter than this is a tap, not a swipe
const SLOP_PX = 8;

// Toward a side it can't go to, the box moves this much of the finger's way
const RESIST = 0.25;

const sideOf = (axis: 'x' | 'y', distance: number): SwipeSide => {
    if (axis === 'x') return distance < 0 ? 'left' : 'right';
    return distance < 0 ? 'up' : 'down';
};

// A box that follows the finger and leaves past a third of its width or half its height (ADR-0037). The drag keeps the
// axis it went along first. `--swipe-x` and `--swipe-y` say where the finger has it.
const useSwipeAway = (options: SwipeAwayOptions) => {
    const { sides, onAway, on = true } = options;
    const [shift, setShift] = useState<{ x: number; y: number } | null>(null);
    const stroke = useRef<Stroke | null>(null);
    const swiped = useRef(false);

    const along = (axis: 'x' | 'y', distance: number) =>
        sides.includes(sideOf(axis, distance)) ? distance : distance * RESIST;

    const onPointerDown = (event: PointerEvent<HTMLElement>) => {
        if (!on || !event.isPrimary) return;
        stroke.current = { x: event.clientX, y: event.clientY, axis: null };
        swiped.current = false;
    };

    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        const current = stroke.current;
        if (!current) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (current.axis === null) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP_PX) return;
            current.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
            swiped.current = true;
            if (typeof event.currentTarget.setPointerCapture === 'function') {
                event.currentTarget.setPointerCapture(event.pointerId);
            }
        }
        setShift(current.axis === 'x' ? { x: along('x', dx), y: 0 } : { x: 0, y: along('y', dy) });
    };

    const onPointerUp = (event: PointerEvent<HTMLElement>) => {
        const current = stroke.current;
        stroke.current = null;
        setShift(null);
        if (!current?.axis) return;
        const distance = current.axis === 'x' ? event.clientX - current.x : event.clientY - current.y;
        const side = sideOf(current.axis, distance);
        const box = event.currentTarget.getBoundingClientRect();
        const needed = current.axis === 'x' ? box.width / 3 : box.height / 2;
        if (sides.includes(side) && Math.abs(distance) > needed) onAway(side);
    };

    const onPointerCancel = () => {
        stroke.current = null;
        setShift(null);
    };

    // The click a swipe ends with reaches none of the buttons inside
    const onClickCapture = (event: MouseEvent<HTMLElement>) => {
        if (!swiped.current) return;
        swiped.current = false;
        event.preventDefault();
        event.stopPropagation();
    };

    const style =
        shift === null ? undefined : ({ '--swipe-x': `${shift.x}px`, '--swipe-y': `${shift.y}px` } as CSSProperties);

    return {
        dragged: shift !== null,
        style,
        handlers: { onClickCapture, onPointerCancel, onPointerDown, onPointerMove, onPointerUp },
    };
};

export { useSwipeAway, type SwipeAwayOptions, type SwipeSide };
