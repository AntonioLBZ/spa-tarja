import { Card } from '@/components/card/card';
import { StoryNarrow } from '@stories/shared/layout';

import type { Meta } from '@storybook/react-vite';

interface CardStoryProps {
    children: string;
    /** Whether its one link covers the whole card */
    linked: boolean;
}

const Story: Meta<CardStoryProps> = {
    title: 'Components/Card',
    args: { children: 'Supermarket', linked: false },
    argTypes: { children: { control: 'text' } },
};

export const Playground = (args: CardStoryProps) => {
    const { children, linked } = args;

    return (
        <StoryNarrow>
            <Card linked={linked}>{linked ? <a href="#card">{children}</a> : children}</Card>
        </StoryNarrow>
    );
};

export default Story;
