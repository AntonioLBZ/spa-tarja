import { ChoiceGroup as ChoiceGroupComponent, type ChoiceGroupProps } from '@/components/choice-group/choice-group';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

const OPTIONS = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
];

const Story: Meta<ChoiceGroupProps<string>> = {
    title: 'Components/ChoiceGroup',
    component: ChoiceGroupComponent,
    args: { legend: 'Theme', name: 'theme', options: OPTIONS, value: 'light' },
    argTypes: { value: { control: 'inline-radio', options: OPTIONS.map((option) => option.value) } },
};

// The choice is kept in the args, so the control follows what is clicked
export const ChoiceGroup = (args: ChoiceGroupProps<string>) => {
    const [, updateArgs] = useArgs();

    return <ChoiceGroupComponent {...args} onChange={(value) => updateArgs({ value })} />;
};

export default Story;
