import { Field } from '@/components/field/field';
import { CategorySelect } from '@/features/categories/category-select';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { useStoryCategories } from './fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';

function CategorySelectDemo(props: { withAll?: boolean; error?: string }) {
    const { withAll, error } = props;
    const t = useTranslations('categories');
    const { options } = useStoryCategories();
    const [value, setValue] = useState(withAll ? 'all' : 'food');
    const shown = withAll ? [{ id: 'all', label: 'All categories' }, ...options] : options;

    return (
        <Field label={t('food')} error={error}>
            {(control) => (
                <CategorySelect {...control} label={t('food')} options={shown} value={value} onChange={setValue} />
            )}
        </Field>
    );
}

const meta = {
    title: 'Features/CategorySelect',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = { render: () => <CategorySelectDemo /> };

const WithAnOptionWithoutIcon: Story = { render: () => <CategorySelectDemo withAll /> };

const WithError: Story = { render: () => <CategorySelectDemo error="Pick a category." /> };

export default meta;
export { Default, WithAnOptionWithoutIcon, WithError };
