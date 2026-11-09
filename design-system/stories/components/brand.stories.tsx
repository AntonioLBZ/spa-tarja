import { Brand as BrandComponent, type BrandProps } from '@/components/brand/brand';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<BrandProps> = {
    title: 'Components/Brand',
    component: BrandComponent,
    args: { size: 'header', prerelease: false },
    argTypes: { size: { control: 'inline-radio', options: ['header', 'hero'] }, prerelease: { control: 'boolean' } },
};

export const Brand = (args: BrandProps) => {
    return <BrandComponent {...args} />;
};

export default Story;
