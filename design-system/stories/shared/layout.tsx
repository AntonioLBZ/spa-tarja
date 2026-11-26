import type { ReactNode } from 'react';

import './shared.css';

interface LayoutProps {
    children: ReactNode;
}

// What a story puts together, one under another
const StoryStack = (props: LayoutProps) => {
    const { children } = props;

    return <div className="story-stack">{children}</div>;
};

// What a story puts together, side by side, wrapping
const StoryRow = (props: LayoutProps) => {
    const { children } = props;

    return <div className="story-row">{children}</div>;
};

// Room under a list that opens over the page
const StoryRoom = (props: LayoutProps) => {
    const { children } = props;

    return <div className="story-room">{children}</div>;
};

// As narrow as a field on a phone
const StoryNarrow = (props: LayoutProps) => {
    const { children } = props;

    return <div className="story-narrow">{children}</div>;
};

export { StoryNarrow, StoryRoom, StoryRow, StoryStack, type LayoutProps };
