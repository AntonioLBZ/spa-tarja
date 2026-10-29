import { StylePicker } from '@/features/categories/style-picker';
import { useState } from 'react';

import type { CategoryStyle } from '@core/category-style';
import type { Meta, StoryObj } from '@storybook/react-vite';

function StylePickerDemo() {
    const [style, setStyle] = useState<CategoryStyle>({ color: 'green', icon: 'pets' });

    return <StylePicker name="look" value={style} onChange={setStyle} />;
}

const meta = {
    title: 'Features/StylePicker',
    render: () => <StylePickerDemo />,
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
