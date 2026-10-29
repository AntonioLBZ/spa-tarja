import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

type Props = Parameters<typeof DateRangeFields>[0];

// The component reports days; the story keeps them so the fields can be typed in
function DateRangeDemo(props: Pick<Props, 'allowEmpty' | 'invalid'> & { initial: Pick<Props, 'from' | 'to'> }) {
    const { initial, ...rest } = props;
    const [range, setRange] = useState(initial);

    return (
        <DateRangeFields
            {...range}
            {...rest}
            labels={{ from: 'From', to: 'To' }}
            onChange={(edge, day) => setRange((current) => ({ ...current, [edge]: day }))}
        />
    );
}

const meta = {
    title: 'Components/DateRangeFields',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {
    render: () => <DateRangeDemo initial={{ from: '2026-10-01', to: '2026-10-29' }} />,
};

const AllowEmpty: Story = {
    render: () => <DateRangeDemo allowEmpty initial={{ from: '', to: '2026-10-29' }} />,
};

const Invalid: Story = {
    render: () => <DateRangeDemo invalid initial={{ from: '2026-10-29', to: '2026-10-01' }} />,
};

export default meta;
export { AllowEmpty, Default, Invalid };
