import { useLayoutEffect, type RefObject } from 'react';

// Marks a scroller with `data-overflow` while what it holds is taller than it. Kept by its size and the size of what it
// holds, not by its scroll, so it is right again once a panel folds and nothing is left to scroll (ADR-0018)
const useOverflowMark = (ref: RefObject<HTMLElement | null>) => {
    useLayoutEffect(() => {
        const scroller = ref.current;
        if (!scroller) return;
        const mark = () => scroller.toggleAttribute('data-overflow', scroller.scrollHeight > scroller.clientHeight);
        mark();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(mark);
        observer.observe(scroller);
        for (const child of scroller.children) observer.observe(child);
        return () => observer.disconnect();
    }, [ref]);
};

export { useOverflowMark };
