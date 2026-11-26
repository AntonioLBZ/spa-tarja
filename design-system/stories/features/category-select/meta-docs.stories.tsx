import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { CategorySelect } from '@/features/categories/category-select';
import { useStoryCategories } from '@stories/shared/fixtures';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/CategorySelect',
    component: CategorySelect,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'code' } } },
};

export const Basic = () => {
    const { options } = useStoryCategories();
    const [value, setValue] = useState('food');

    return (
        <Field label="Category">
            {(control) => <CategorySelect {...control} options={options} value={value} onChange={setValue} />}
        </Field>
    );
};

export const All = () => {
    const { options } = useStoryCategories();
    const [value, setValue] = useState('all');

    return (
        <Field label="Category">
            {(control) => (
                <CategorySelect
                    {...control}
                    options={[{ id: 'all', label: 'All categories', icon: <Icon name="apps" /> }, ...options]}
                    value={value}
                    onChange={setValue}
                />
            )}
        </Field>
    );
};

export default Story;
