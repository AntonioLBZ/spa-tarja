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

interface BottomNavProps {
    // Names the navigation for assistive technology
    label: string;
    items: readonly BottomNavItem[];
}

// The tab bar of a phone: an icon over its word for each destination, the current one marked
const BottomNav = (props: BottomNavProps) => {
    const { label, items } = props;

    return (
        <nav aria-label={label} className="bottom-nav">
            <ul className="bottom-nav__list">
                {items.map((item) => {
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
                })}
            </ul>
        </nav>
    );
};

export { BottomNav, type BottomNavItem, type BottomNavProps };
