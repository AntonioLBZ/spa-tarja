import { Link, type LinkProps } from '@tanstack/react-router';
import clsx from 'clsx';

import { Icon } from '@/components/icon/icon';

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

// The tab bar of a phone: an icon over its word for each destination, the current one marked, and in the middle the
// action, whose icon sits in an accent square
const BottomNav = (props: BottomNavProps) => {
    const { label, items, action } = props;

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
                    <Icon name={item.icon} />
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
            <ul className="bottom-nav__list">{links}</ul>
        </nav>
    );
};

export { BottomNav, type BottomNavAction, type BottomNavItem, type BottomNavProps };
