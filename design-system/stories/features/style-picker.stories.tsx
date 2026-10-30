import { StylePicker as StylePickerComponent, type StylePickerProps } from '@/features/categories/style-picker';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<StylePickerProps> = {
    title: 'Features/StylePicker',
    component: StylePickerComponent,
    args: { name: 'look', value: { color: 'green', icon: 'pets' } },
    argTypes: { name: { control: 'text' }, onChange: { control: false } },
};

// The look is kept in the args, so the control follows what is clicked
export const StylePicker = (args: StylePickerProps) => {
    const [, updateArgs] = useArgs();

    return <StylePickerComponent {...args} onChange={(value) => updateArgs({ value })} />;
};

export default Story;
