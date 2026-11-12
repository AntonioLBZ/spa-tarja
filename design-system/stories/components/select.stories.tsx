import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Select as SelectComponent, type SelectProps } from '@/components/select/select';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

interface SelectStoryProps extends Omit<SelectProps<string>, 'id' | 'options'> {
    label: string;
    icons: boolean;
}

const OPTIONS = [
    { value: 'food', label: 'Food', icon: 'restaurant' },
    { value: 'groceries', label: 'Groceries', icon: 'shopping_cart' },
    { value: 'gym', label: 'Gym', icon: 'fitness_center' },
    { value: 'other', label: 'Other' },
] as const;

const Story: Meta<SelectStoryProps> = {
    title: 'Components/Select',
    args: { label: 'Category', value: 'food', icons: true, disabled: false },
    argTypes: {
        value: { control: 'inline-radio', options: OPTIONS.map((option) => option.value) },
        label: { control: 'text' },
        'aria-describedby': { control: false },
        'aria-invalid': { control: false },
        onChange: { control: false },
    },
    // Room for the list to open under the field
    decorators: [
        (Decorated) => (
            <div style={{ minHeight: '20rem' }}>
                <Decorated />
            </div>
        ),
    ],
};

// The choice is kept in the args, so the control follows what is clicked
export const Select = (args: SelectStoryProps) => {
    const { label, icons, ...props } = args;
    const [, updateArgs] = useArgs();
    const options = OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        icon: icons && 'icon' in option ? <Icon name={option.icon} /> : undefined,
    }));

    return (
        <Field label={label}>
            {(control) => (
                <SelectComponent
                    {...props}
                    {...control}
                    options={options}
                    onChange={(value) => updateArgs({ value })}
                />
            )}
        </Field>
    );
};

export default Story;
