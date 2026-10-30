import { Field } from '@/components/field/field';
import {
    CategorySelect as CategorySelectComponent,
    type CategorySelectProps,
} from '@/features/categories/category-select';
import { DEFAULT_CATEGORY_IDS } from '@core/categories';
import { useArgs } from 'storybook/preview-api';

import { CUSTOM_CATEGORIES, useStoryCategories } from './fixtures';

import type { Meta } from '@storybook/react-vite';

interface CategorySelectStoryProps extends Omit<CategorySelectProps, 'id' | 'options'> {
    // Adds an option with no icon, like the "All categories" of the filters
    withAll: boolean;
    error: string;
}

const Story: Meta<CategorySelectStoryProps> = {
    title: 'Features/CategorySelect',
    args: { label: 'Category', value: 'food', withAll: false, error: '' },
    argTypes: {
        label: { control: 'text' },
        value: {
            control: 'select',
            options: ['all', ...DEFAULT_CATEGORY_IDS, ...CUSTOM_CATEGORIES.map(({ id }) => id)],
        },
        error: { control: 'text' },
        'aria-describedby': { control: false },
        'aria-invalid': { control: false },
        onChange: { control: false },
    },
    // Room for the list to open under the field
    decorators: [
        (Decorated) => (
            <div style={{ minHeight: '24rem' }}>
                <Decorated />
            </div>
        ),
    ],
};

// The choice is kept in the args, so the control follows what is clicked
export const CategorySelect = (args: CategorySelectStoryProps) => {
    const { withAll, error, ...props } = args;
    const [, updateArgs] = useArgs();
    const { options } = useStoryCategories();
    const shown = withAll ? [{ id: 'all', label: 'All categories' }, ...options] : options;

    return (
        <Field label={props.label} error={error || undefined}>
            {(control) => (
                <CategorySelectComponent
                    {...props}
                    {...control}
                    options={shown}
                    onChange={(value) => updateArgs({ value })}
                />
            )}
        </Field>
    );
};

export default Story;
