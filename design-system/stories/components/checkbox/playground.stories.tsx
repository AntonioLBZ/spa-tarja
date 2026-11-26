import { Checkbox } from '@/components/checkbox/checkbox';
import { StoryNarrow } from '@stories/shared/layout';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface CheckboxStoryProps {
    label: string;
    /** Empty for none */
    hint: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}

const Story: Meta<CheckboxStoryProps> = {
    title: 'Components/Checkbox',
    args: {
        label: 'Show in my expenses',
        hint: "When it's off, this group's expenses are not in your list, summary, charts or budgets.",
        checked: true,
        disabled: false,
        onChange: fn(),
    },
    argTypes: {
        label: { control: 'text' },
        hint: { control: 'text' },
        onChange: { table: { disable: true } },
    },
};

export const Playground = (args: CheckboxStoryProps) => {
    const { hint, onChange, ...props } = args;
    const [, updateArgs] = useArgs();

    return (
        <StoryNarrow>
            <Checkbox
                {...props}
                hint={hint || undefined}
                onChange={(checked) => {
                    onChange(checked);
                    updateArgs({ checked });
                }}
            />
        </StoryNarrow>
    );
};

export default Story;
