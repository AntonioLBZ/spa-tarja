import { createLink } from '@tanstack/react-router';
import clsx from 'clsx';

import type { ComponentPropsWithRef } from 'react';

import './tab.css';

type TabAnchorProps = ComponentPropsWithRef<'a'>;

const TabAnchor = (props: TabAnchorProps) => {
    const { className, children, ...rest } = props;
    const tabClsx = clsx('tab', className);

    return (
        <a {...rest} className={tabClsx}>
            <span className="tab__word">{children}</span>
        </a>
    );
};

// A tab that leads to a screen, current while its route is shown. Typed like `Link`
const TabLink = createLink(TabAnchor);

export { TabLink };
