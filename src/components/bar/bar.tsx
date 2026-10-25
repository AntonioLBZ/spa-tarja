import type { CSSProperties } from 'react';

import './bar.css';

// A flat bar filled to a share (0 to 1) of its track. Decoration: the number it stands for always sits next to it.
function Bar(props: { share: number }) {
    const { share } = props;

    return (
        <span className="bar" aria-hidden="true">
            <span className="bar__fill" style={{ '--share': share } as CSSProperties} />
        </span>
    );
}

export { Bar };
