import { Button } from '@/components/button/button';
import { LiveNotice as LiveNoticeComponent, type LiveNoticeProps } from '@/components/notice/live-notice';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

interface LiveNoticeStoryProps extends Omit<LiveNoticeProps, 'children'> {
    message: string;
}

const Story: Meta<LiveNoticeStoryProps> = {
    title: 'Components/LiveNotice',
    args: { tone: 'info', message: 'You are offline: changes are saved on this device and sent later.' },
    argTypes: { message: { control: 'text' }, tone: { control: 'inline-radio', options: ['info', 'danger', 'quiet'] } },
};

export const LiveNotice = (args: LiveNoticeStoryProps) => {
    const { message, ...notice } = args;
    const [shown, setShown] = useState(false);

    return (
        <div style={{ display: 'grid', gap: 'var(--size-4)' }}>
            <LiveNoticeComponent {...notice}>{shown && message}</LiveNoticeComponent>
            <Button onClick={() => setShown((current) => !current)}>{shown ? 'Take it away' : 'Say it'}</Button>
        </div>
    );
};

export default Story;
