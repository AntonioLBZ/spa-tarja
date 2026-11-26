import { Account } from '@/features/auth/account';
import { withAppData } from '@stories/shared/app-data';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/Account',
    component: Account,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: { docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 360 } } },
};

export const Basic = () => {
    return <Account />;
};

export default Story;
