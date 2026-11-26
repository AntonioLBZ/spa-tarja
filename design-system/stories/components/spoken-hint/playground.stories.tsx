import { Field } from '@/components/field/field';
import { SpokenHint } from '@/components/field/spoken-hint';
import { StoryNarrow } from '@stories/shared/layout';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

interface SpokenHintStoryProps {
    /** How much of the split the field starts with; the hint says what is left */
    percent: string;
}

const PercentField = (props: SpokenHintStoryProps) => {
    const [value, setValue] = useState(props.percent);
    const left = 100 - (Number(value) || 0);

    return (
        <StoryNarrow>
            <Field label="Percent">
                {(control) => (
                    <input
                        {...control}
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                    />
                )}
            </Field>
            <SpokenHint>{value !== '' && left > 0 && `${left}% left`}</SpokenHint>
        </StoryNarrow>
    );
};

const Story: Meta<SpokenHintStoryProps> = {
    title: 'Components/SpokenHint',
    args: { percent: '' },
    argTypes: { percent: { control: 'text' } },
};

export const Playground = (args: SpokenHintStoryProps) => {
    return <PercentField key={args.percent} {...args} />;
};

export default Story;
