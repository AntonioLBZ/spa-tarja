import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Select } from '@/components/select/select';
import { StoryNarrow, StoryRoom } from '@stories/shared/layout';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface SelectStoryProps {
    label: string;
    value: string;
    /** Whether the options draw their icons */
    icons: boolean;
    disabled: boolean;
    /** Empty for no problem */
    error: string;
    onChange: (value: string) => void;
}

const OPTIONS = [
    { value: 'food', label: 'Food', icon: 'restaurant' },
    { value: 'groceries', label: 'Groceries', icon: 'shopping_cart' },
    { value: 'gym', label: 'Gym', icon: 'fitness_center' },
    { value: 'other', label: 'Other' },
] as const;

const Story: Meta<SelectStoryProps> = {
    title: 'Components/Select',
    args: { label: 'Category', value: 'food', icons: true, disabled: false, error: '', onChange: fn() },
    argTypes: {
        label: { control: 'text' },
        value: { control: 'inline-radio', options: OPTIONS.map((option) => option.value) },
        error: { control: 'text' },
        onChange: { table: { disable: true } },
    },
};

export const Playground = (args: SelectStoryProps) => {
    const { label, value, icons, disabled, error, onChange } = args;
    const [, updateArgs] = useArgs();
    const options = OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        icon: icons && 'icon' in option ? <Icon name={option.icon} /> : undefined,
    }));

    return (
        <StoryRoom>
            <StoryNarrow>
                <Field label={label} error={error || undefined}>
                    {(control) => (
                        <Select
                            {...control}
                            disabled={disabled}
                            options={options}
                            value={value}
                            onChange={(next) => {
                                onChange(next);
                                updateArgs({ value: next });
                            }}
                        />
                    )}
                </Field>
            </StoryNarrow>
        </StoryRoom>
    );
};

export default Story;
