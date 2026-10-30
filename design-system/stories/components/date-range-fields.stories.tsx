import {
    DateRangeFields as DateRangeFieldsComponent,
    type DateRangeFieldsProps,
} from '@/components/date-range-fields/date-range-fields';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<DateRangeFieldsProps> = {
    title: 'Components/DateRangeFields',
    component: DateRangeFieldsComponent,
    args: {
        from: '2026-10-01',
        to: '2026-10-29',
        labels: { from: 'From', to: 'To' },
        allowEmpty: false,
        invalid: false,
    },
};

// The days are kept in the args, so the controls follow what is typed
export const DateRangeFields = (args: DateRangeFieldsProps) => {
    const [, updateArgs] = useArgs();

    return <DateRangeFieldsComponent {...args} onChange={(edge, day) => updateArgs({ [edge]: day })} />;
};

export default Story;
