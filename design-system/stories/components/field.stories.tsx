import { Field as FieldComponent, type FieldProps } from '@/components/field/field';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<FieldProps> = {
    title: 'Components/Field',
    component: FieldComponent,
    args: {
        label: 'Amount',
        children: (control) => <input type="text" inputMode="decimal" {...control} />,
    },
    argTypes: {
        children: { control: false },
        label: { control: 'text' },
        hint: { control: 'text' },
        error: { control: 'text' },
    },
};

export const Field = (args: FieldProps) => {
    return <FieldComponent {...args} />;
};

export default Story;
