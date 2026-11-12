import { Link, type LinkProps } from '@tanstack/react-router';
import clsx from 'clsx';
import { useRef } from 'react';

import { Icon } from '@/components/icon/icon';
import { DURATION, EASE, MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';

import type { IconName } from '@/components/icon/icon-paths';
import type { MouseEvent } from 'react';

import './bottom-nav.css';

interface BottomNavItem {
    to: LinkProps['to'];
    label: string;
    icon: IconName;
    current: boolean;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

// A button among the links, not a destination: it does something, and is never the current one
interface BottomNavAction {
    // Names the button for assistive technology; it holds the word that shows
    label: string;
    // Under the icon, as the links have theirs
    word: string;
    icon: IconName;
    onPress: () => void;
}

interface BottomNavProps {
    // Names the navigation for assistive technology
    label: string;
    items: readonly BottomNavItem[];
    // Drawn in the middle of the items
    action?: BottomNavAction;
}

// The tab bar of a phone: an icon over its word for each destination, a pill under the icon of the current one that
// glides to the next, and in the middle the action, raised over the bar
const BottomNav = (props: BottomNavProps) => {
    const { label, items, action } = props;
    const list = useRef<HTMLUListElement>(null);
    const pill = useRef<HTMLLIElement>(null);
    const currentLabel = items.find((item) => item.current)?.label;

    useGSAP(
        () => {
            const track = list.current;
            const mark = pill.current;
            if (!track || !mark || !canAnimate()) return;
            const icon = track.querySelector<HTMLElement>('[aria-current="page"] .bottom-nav__icon');
            if (!icon) {
                gsap.set(mark, { autoAlpha: 0 });
                return;
            }

            const place = () => {
                const box = track.getBoundingClientRect();
                const at = icon.getBoundingClientRect();
                return { x: at.left - box.left, y: at.top - box.top, width: at.width, height: at.height };
            };
            track.dataset.glide = '';

            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                const to = place();
                // Not drawn yet, or put back by a revert: it appears in place, with no trip from where it was
                if (Number(gsap.getProperty(mark, 'opacity')) === 0) {
                    gsap.set(mark, { ...to, autoAlpha: 1 });
                    return;
                }
                const from = { x: Number(gsap.getProperty(mark, 'x')), width: Number(gsap.getProperty(mark, 'width')) };
                const reach = Math.min(from.x, to.x);
                const span = Math.abs(to.x - from.x) + to.width;
                gsap.timeline()
                    .to(mark, { x: reach, width: span, duration: DURATION.fast, ease: EASE.standard })
                    .to(mark, { x: to.x, width: to.width, duration: DURATION.slow, ease: EASE.enter });
            });
            mm.add(`not all and ${MOTION_QUERY}`, () => {
                gsap.set(mark, { ...place(), autoAlpha: 1 });
            });

            const onResize = () => gsap.set(mark, place());
            window.addEventListener('resize', onResize);
            return () => {
                window.removeEventListener('resize', onResize);
                mm.revert();
            };
        },
        { dependencies: [currentLabel] }
    );

    const links = items.map((item) => {
        const linkClsx = clsx('bottom-nav__link', { 'bottom-nav__link--current': item.current });

        return (
            <li key={item.label}>
                <Link
                    className={linkClsx}
                    to={item.to}
                    activeOptions={{ exact: true }}
                    aria-current={item.current ? 'page' : undefined}
                    onClick={item.onClick}
                >
                    <span className="bottom-nav__icon">
                        <Icon name={item.icon} />
                    </span>
                    <span className="bottom-nav__word">{item.label}</span>
                </Link>
            </li>
        );
    });

    if (action) {
        links.splice(
            Math.ceil(items.length / 2),
            0,
            <li key="action">
                <button
                    className="bottom-nav__button"
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={action.label}
                    onClick={action.onPress}
                >
                    <span className="bottom-nav__square">
                        <Icon name={action.icon} />
                    </span>
                    <span className="bottom-nav__word">{action.word}</span>
                </button>
            </li>
        );
    }

    return (
        <nav aria-label={label} className="bottom-nav">
            <ul ref={list} className="bottom-nav__list">
                <li ref={pill} aria-hidden="true" className="bottom-nav__pill" />
                {links}
            </ul>
        </nav>
    );
};

export { BottomNav, type BottomNavAction, type BottomNavItem, type BottomNavProps };
