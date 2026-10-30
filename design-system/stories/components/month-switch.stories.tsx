import { MonthSwitch as MonthSwitchComponent, type MonthSwitchProps } from '@/components/month-switch/month-switch';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<MonthSwitchProps> = {
    title: 'Components/MonthSwitch',
    component: MonthSwitchComponent,
    args: {
        monthName: 'October 2026',
        labels: { previous: 'Previous month', next: 'Next month' },
        onPrevious: fn(),
        onNext: fn(),
    },
};

export const MonthSwitch = (args: MonthSwitchProps) => {
    return <MonthSwitchComponent {...args} />;
};

export default Story;
