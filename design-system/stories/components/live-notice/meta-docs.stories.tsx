import { Button } from '@/components/button/button';
import { LiveNotice } from '@/components/notice/live-notice';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/LiveNotice/Examples',
    component: LiveNotice,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [copied, setCopied] = useState(false);

    return (
        <>
            <Button onClick={() => setCopied(true)}>Copy link</Button>
            <LiveNotice>{copied && 'Link copied.'}</LiveNotice>
        </>
    );
};

export default Story;
