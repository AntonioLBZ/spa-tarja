import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { Notice } from '@/components/notice/notice';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/DateRangeFields/Examples',
    component: DateRangeFields,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [days, setDays] = useState({ from: '2026-11-01', to: '2026-11-30' });

    return (
        <DateRangeFields
            {...days}
            labels={{ from: 'From', to: 'To' }}
            onChange={(edge, day) => setDays((current) => ({ ...current, [edge]: day }))}
        />
    );
};

export const AllowEmpty = () => {
    const [days, setDays] = useState({ from: '', to: '' });

    return (
        <DateRangeFields
            {...days}
            allowEmpty
            labels={{ from: 'From', to: 'To' }}
            onChange={(edge, day) => setDays((current) => ({ ...current, [edge]: day }))}
        />
    );
};

export const Invalid = () => {
    const [days, setDays] = useState({ from: '2026-11-30', to: '2026-11-01' });

    return (
        <>
            <DateRangeFields
                {...days}
                invalid
                describedBy="range-error"
                labels={{ from: 'From', to: 'To' }}
                onChange={(edge, day) => setDays((current) => ({ ...current, [edge]: day }))}
            />
            <Notice id="range-error" tone="danger">
                The start can't be after the end.
            </Notice>
        </>
    );
};

export default Story;
