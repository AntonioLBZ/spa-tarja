import { Checkbox as CheckboxComponent, type CheckboxProps } from '@/components/checkbox/checkbox';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<CheckboxProps> = {
    title: 'Components/Checkbox',
    component: CheckboxComponent,
    args: {
        label: 'Show in my expenses',
        hint: "When it's off, this group's expenses are not in your list, summary, charts or budgets.",
        checked: true,
        disabled: false,
    },
    argTypes: {
        label: { control: 'text' },
        hint: { control: 'text' },
        onChange: { control: false },
    },
};

// The state is kept in the args, so the `checked` control follows what is clicked
export const Checkbox = (args: CheckboxProps) => {
    const [, updateArgs] = useArgs();

    return <CheckboxComponent {...args} onChange={(checked) => updateArgs({ checked })} />;
};

export default Story;
