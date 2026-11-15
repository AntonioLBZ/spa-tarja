import clsx from 'clsx';

import type { ReactNode } from 'react';

import './actions.css';

interface ActionsProps {
    className?: string;
    children: ReactNode;
}

// A row of actions that wraps when it doesn't fit
const Actions = (props: ActionsProps) => {
    const { className, children } = props;
    const actionsClsx = clsx('actions', className);

    return <div className={actionsClsx}>{children}</div>;
};

export { Actions, type ActionsProps };
