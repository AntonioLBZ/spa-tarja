import { Brand, type BrandProps } from '@/components/brand/brand';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<BrandProps> = {
    title: 'Components/Brand',
    component: Brand,
    args: { size: 'header', prerelease: false },
    argTypes: { size: { control: 'inline-radio', options: ['header', 'hero'] } },
};

export const Playground = (args: BrandProps) => {
    return <Brand {...args} />;
};

export default Story;
