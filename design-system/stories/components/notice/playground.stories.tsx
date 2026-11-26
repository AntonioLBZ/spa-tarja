import { Notice } from '@/components/notice/notice';
import { StoryNarrow } from '@stories/shared/layout';

import type { Meta } from '@storybook/react-vite';

interface NoticeStoryProps {
    tone: 'info' | 'danger' | 'quiet';
    children: string;
}

const Story: Meta<NoticeStoryProps> = {
    title: 'Components/Notice',
    args: { tone: 'info', children: 'You are offline: changes are saved on this device and sent later.' },
    argTypes: {
        children: { control: 'text' },
        tone: { control: 'inline-radio', options: ['info', 'danger', 'quiet'] },
    },
};

export const Playground = (args: NoticeStoryProps) => {
    return (
        <StoryNarrow>
            <Notice {...args} />
        </StoryNarrow>
    );
};

export default Story;
