import { ScreenTitle } from '@/components/screen-title/screen-title';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/ScreenTitle/Examples',
    component: ScreenTitle,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <ScreenTitle>Expenses</ScreenTitle>;
};

export default Story;
