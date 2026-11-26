import type { ReactNode } from 'react';

import './shared.css';

interface SampleFrameProps {
    children: ReactNode;
}

// A box that stands for the page, for what sits on a fixed edge of it (the bottom bar, the toast, the banner)
const SampleFrame = (props: SampleFrameProps) => {
    const { children } = props;

    return <div className="sample-frame">{children}</div>;
};

export { SampleFrame, type SampleFrameProps };
