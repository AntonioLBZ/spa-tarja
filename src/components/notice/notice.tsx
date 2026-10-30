import clsx from 'clsx';

import type { ReactNode } from 'react';

import './notice.css';

interface NoticeProps {
    // Ink for information, the danger color for errors, a hairline for what is only background
    tone?: 'info' | 'danger' | 'quiet';
    role?: 'alert' | 'status';
    id?: string;
    className?: string;
    children: ReactNode;
}

// A message set apart by a thick left edge. The element that carries `role` holds only the text.
const Notice = (props: NoticeProps) => {
    const { tone = 'info', role, id, className, children } = props;
    const noticeClsx = clsx('notice', `notice--${tone}`, className);

    return (
        <p className={noticeClsx} id={id} role={role}>
            {children}
        </p>
    );
};

export { Notice, type NoticeProps };
