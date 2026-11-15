import { useEffect, useEffectEvent, type RefObject } from 'react';

import type { SwipeDirection } from './route-transition';

// Left free at each side of the screen for the back gesture of the system
const EDGE_PX = 24;
// Movement under this is still a tap
const SLOP_PX = 10;
// A swipe goes this share of the width, or this far at this speed (px per ms)
const DISTANCE_SHARE = 0.3;
const FLICK_PX = 48;
const FLICK_SPEED = 0.4;
// The click a browser may still send at the end of a swipe is swallowed for this long
const CLICK_GUARD_MS = 400;

// What a swipe never starts on: a control that takes a drag or the text, a dialog, and what asks for none
const KEEPS_THE_DRAG = 'input, textarea, select, [contenteditable], dialog, [data-no-swipe]';

interface Stroke {
    pointerId: number;
    x: number;
    y: number;
    at: number;
}

// Something between the start of the touch and the area that scrolls sideways keeps the drag for itself
const scrollsSideways = (from: Element, area: Element) => {
    for (let element: Element | null = from; element && element !== area; element = element.parentElement) {
        const { overflowX } = getComputedStyle(element);
        if ((overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth) return true;
    }
    return false;
};

// The finger crossed the screen far enough, or flicked it, and mostly sideways
const swiped = (dx: number, dy: number, ms: number) => {
    const distance = Math.abs(dx);
    if (distance < 2 * Math.abs(dy)) return false;
    if (distance >= window.innerWidth * DISTANCE_SHARE) return true;
    return distance >= FLICK_PX && distance / Math.max(ms, 1) >= FLICK_SPEED;
};

// A swipe of a finger across the area: to the left it asks for the next screen, to the right for the previous one.
// While a view transition runs the browser sends the touch to the root, so a touch there counts too.
const useSwipe = (area: RefObject<HTMLElement | null>, onSwipe: (direction: SwipeDirection) => void, on: boolean) => {
    const swipe = useEffectEvent(onSwipe);

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
            stroke = null;
            if (!event.isPrimary || event.pointerType !== 'touch' || !startsHere(event.target)) return;
            if (event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX) return;
            stroke = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
        };

        const onMove = (event: PointerEvent) => {
            if (stroke?.pointerId !== event.pointerId) return;
            const dy = Math.abs(event.clientY - stroke.y);
            if (dy > SLOP_PX && dy > Math.abs(event.clientX - stroke.x)) stroke = null;
        };

        const onUp = (event: PointerEvent) => {
            if (stroke?.pointerId !== event.pointerId) return;
            const dx = event.clientX - stroke.x;
            const dy = event.clientY - stroke.y;
            const ms = event.timeStamp - stroke.at;
            stroke = null;
            if (Math.abs(dx) > SLOP_PX) guardUntil = event.timeStamp + CLICK_GUARD_MS;
            if (swiped(dx, dy, ms)) swipe(dx < 0 ? 'next' : 'previous');
        };

        const onCancel = () => {
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
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointermove', onMove, true);
            document.removeEventListener('pointerup', onUp, true);
            document.removeEventListener('pointercancel', onCancel, true);
            document.removeEventListener('click', onClick, true);
        };
    }, [area, on]);
};

export { useSwipe };
