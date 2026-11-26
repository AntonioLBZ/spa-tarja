import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import { useAnnounce } from '@/components/announcer/announcer';
import { sayWhenSwipeIsDecided, showHeading, takeArrival } from '@/lib/a11y';

import './screen-title.css';

const APP_NAME = 'Tarja';

interface ScreenTitleProps {
    /** The name of the screen: the text of the heading, and the title of the page ahead of the name of the app */
    children: string;
    className?: string;
}

// The `h1` of a screen, the one place that names it. It sets the title of the page, and when its screen has just
// opened it takes the focus or says its text, as the way the screen was reached asks (`useScreenArrivals`; a swiped
// screen says it once the swipe is decided). It can take the focus without being in the tab order.
const ScreenTitle = (props: ScreenTitleProps) => {
    const { children, className } = props;
    const announce = useAnnounce();
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        document.title = `${children} – ${APP_NAME}`;
        return () => {
            document.title = APP_NAME;
        };
    }, [children]);

    useEffect(() => {
        const node = heading.current;
        showHeading(node);
        const arrival = takeArrival();
        if (arrival === 'focus') node?.focus({ preventScroll: true });
        else if (arrival === 'announce') announce(children);
        else if (arrival === 'hold') sayWhenSwipeIsDecided(() => announce(children));
        return () => showHeading(null);
    }, [children, announce]);

    return (
        <h1 ref={heading} className={clsx('screen-title', className)} tabIndex={-1}>
            {children}
        </h1>
    );
};

export { ScreenTitle, type ScreenTitleProps };
