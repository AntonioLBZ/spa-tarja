import clsx from 'clsx';
import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

import { Icon } from '@/components/icon/icon';

import './scroll-strip.css';

type ScrollStripProps = ComponentPropsWithoutRef<'div'> & {
    // Runs to the edges of the screen, padded by the gutter of the page, instead of stopping at the page's edges
    bleed?: boolean;
};

// How much of what is in view one press of an arrow takes along
const STEP = 0.75;

// A row of things that scrolls sideways when they don't fit, and says so: the edge that has more past it fades out,
// and with a mouse an arrow on that edge takes the row along. The arrows are for the pointer only, since the row can be
// reached by keyboard (each thing scrolls into view when it takes the focus) and by touch.
const ScrollStrip = (props: ScrollStripProps) => {
    const { bleed, className, children, ...rest } = props;
    const root = useRef<HTMLDivElement>(null);
    const track = useRef<HTMLDivElement>(null);
    const stripClsx = clsx('scroll-strip', { 'scroll-strip--bleed': bleed }, className);

    // Not state: it only sets two attributes the styles read, and never changes what is rendered
    const measure = () => {
        const box = track.current;
        if (!box || !root.current) return;
        root.current.toggleAttribute('data-before', box.scrollLeft > 1);
        root.current.toggleAttribute('data-after', box.scrollLeft < box.scrollWidth - box.clientWidth - 1);
    };

    useEffect(() => {
        measure();
        const box = track.current;
        if (!box || typeof ResizeObserver === 'undefined') return;
        const watcher = new ResizeObserver(measure);
        watcher.observe(box);
        return () => watcher.disconnect();
    });

    const go = (direction: 1 | -1) => {
        const box = track.current;
        if (!box) return;
        const still =
            typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        box.scrollBy({ left: direction * box.clientWidth * STEP, behavior: still ? 'auto' : 'smooth' });
    };

    return (
        <div ref={root} className={stripClsx}>
            <div {...rest} ref={track} className="scroll-strip__track" onScroll={measure}>
                {children}
            </div>
            <button
                aria-hidden="true"
                className="scroll-strip__arrow scroll-strip__arrow--before"
                tabIndex={-1}
                type="button"
                onClick={() => go(-1)}
            >
                <Icon name="chevron_left" />
            </button>
            <button
                aria-hidden="true"
                className="scroll-strip__arrow scroll-strip__arrow--after"
                tabIndex={-1}
                type="button"
                onClick={() => go(1)}
            >
                <Icon name="chevron_right" />
            </button>
        </div>
    );
};

export { ScrollStrip, type ScrollStripProps };
