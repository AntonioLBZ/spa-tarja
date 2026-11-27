import { About } from '@/features/about/about';
import { withAppData } from '@stories/shared/app-data';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/About',
    component: About,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: { docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 220 } } },
};

export const Basic = () => {
    return <About />;
};

export default Story;
