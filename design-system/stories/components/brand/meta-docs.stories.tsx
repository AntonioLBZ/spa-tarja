import { Brand } from '@/components/brand/brand';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Brand/Examples',
    component: Brand,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <Brand />;
};

export const Hero = () => {
    return <Brand size="hero" />;
};

export const Prerelease = () => {
    return <Brand prerelease />;
};

export default Story;
