import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { StoryNarrow } from '@stories/shared/layout';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

interface DateRangeFieldsStoryProps {
    from: string;
    to: string;
    allowEmpty: boolean;
    invalid: boolean;
}

const Story: Meta<DateRangeFieldsStoryProps> = {
    title: 'Components/DateRangeFields',
    args: { from: '2026-10-01', to: '2026-10-29', allowEmpty: false, invalid: false },
    argTypes: { from: { control: 'text' }, to: { control: 'text' } },
};

export const Playground = (args: DateRangeFieldsStoryProps) => {
    const [, updateArgs] = useArgs();

    return (
        <StoryNarrow>
            <DateRangeFields
                {...args}
                labels={{ from: 'From', to: 'To' }}
                onChange={(edge, day) => updateArgs({ [edge]: day })}
            />
        </StoryNarrow>
    );
};

export default Story;
