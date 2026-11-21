import { Notice, type NoticeProps } from './notice';

import type { ReactNode } from 'react';

interface LiveNoticeProps extends Omit<NoticeProps, 'role' | 'children'> {
    // The message, or nothing while there is none to say
    children?: ReactNode;
}

// A notice that comes and goes, such as being offline or a failed load. A live region that arrives already filled is
// announced inconsistently, so the region is always in the page and only what is inside it changes. Empty, it takes no
// room.
const LiveNotice = (props: LiveNoticeProps) => {
    const { children, ...notice } = props;

    return (
        <div className="live-notice" role="status">
            {children ? <Notice {...notice}>{children}</Notice> : null}
        </div>
    );
};

export { LiveNotice, type LiveNoticeProps };
