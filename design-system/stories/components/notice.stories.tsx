import { Notice as NoticeComponent, type NoticeProps } from '@/components/notice/notice';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<NoticeProps> = {
    title: 'Components/Notice',
    component: NoticeComponent,
    args: { tone: 'info', children: 'You are offline: changes are saved on this device and sent later.' },
    argTypes: {
        children: { control: 'text' },
        tone: { control: 'inline-radio', options: ['info', 'danger', 'quiet'] },
        role: { control: 'inline-radio', options: [undefined, 'alert', 'status'] },
    },
};

export const Notice = (args: NoticeProps) => {
    return <NoticeComponent {...args} />;
};

export default Story;
