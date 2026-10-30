import { Button as ButtonComponent, type ButtonProps } from '@/components/button/button';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<ButtonProps> = {
    title: 'Components/Button',
    component: ButtonComponent,
    args: {
        children: 'Save',
        variant: 'default',
        disabled: false,
        glyph: false,
        ghost: false,
        pressed: false,
        onClick: fn(),
    },
    argTypes: {
        children: { control: 'text' },
        variant: { control: 'inline-radio', options: ['default', 'primary', 'danger'] },
    },
};

export const Button = (args: ButtonProps) => {
    return <ButtonComponent {...args} />;
};

export default Story;
