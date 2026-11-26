import { StylePicker } from '@/features/categories/style-picker';
import { useState } from 'react';

import type { CategoryStyle } from '@core/categories/category-style';
import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/StylePicker',
    component: StylePicker,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [value, setValue] = useState<CategoryStyle>({ color: 'green', icon: 'pets' });

    return <StylePicker name="look" value={value} onChange={setValue} />;
};

export default Story;
