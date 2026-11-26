import { MonthSwitch } from '@/components/month-switch/month-switch';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/MonthSwitch/Examples',
    component: MonthSwitch,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

const MONTHS = ['September 2026', 'October 2026', 'November 2026'];

export const Basic = () => {
    const [month, setMonth] = useState(2);

    return (
        <MonthSwitch
            monthName={MONTHS[month]!}
            labels={{ previous: 'Previous month', next: 'Next month' }}
            onPrevious={() => setMonth((current) => Math.max(0, current - 1))}
            onNext={() => setMonth((current) => Math.min(MONTHS.length - 1, current + 1))}
        />
    );
};

export default Story;
