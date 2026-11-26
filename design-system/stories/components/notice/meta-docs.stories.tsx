import { Notice } from '@/components/notice/notice';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Notice/Examples',
    component: Notice,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <Notice>You are offline: changes are saved on this device and sent later.</Notice>;
};

export const Danger = () => {
    return (
        <Notice tone="danger" role="alert">
            Couldn&apos;t save your nickname. Try again.
        </Notice>
    );
};

export const Quiet = () => {
    return <Notice tone="quiet">No expenses this month.</Notice>;
};

export default Story;
