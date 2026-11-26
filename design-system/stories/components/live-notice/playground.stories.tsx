import { Button } from '@/components/button/button';
import { LiveNotice } from '@/components/notice/live-notice';
import { StoryNarrow, StoryStack } from '@stories/shared/layout';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

interface LiveNoticeStoryProps {
    tone: 'info' | 'danger' | 'quiet';
    message: string;
}

const Story: Meta<LiveNoticeStoryProps> = {
    title: 'Components/LiveNotice',
    args: { tone: 'info', message: 'You are offline: changes are saved on this device and sent later.' },
    argTypes: {
        message: { control: 'text' },
        tone: { control: 'inline-radio', options: ['info', 'danger', 'quiet'] },
    },
};

export const Playground = (args: LiveNoticeStoryProps) => {
    const { message, tone } = args;
    const [shown, setShown] = useState(false);

    return (
        <StoryNarrow>
            <StoryStack>
                <LiveNotice tone={tone}>{shown && message}</LiveNotice>
                <Button onClick={() => setShown((current) => !current)}>{shown ? 'Take it away' : 'Say it'}</Button>
            </StoryStack>
        </StoryNarrow>
    );
};

export default Story;
