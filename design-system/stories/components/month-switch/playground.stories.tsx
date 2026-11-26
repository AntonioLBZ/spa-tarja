import { MonthSwitch } from '@/components/month-switch/month-switch';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface MonthSwitchStoryProps {
    monthName: string;
    onPrevious: () => void;
    onNext: () => void;
}

const Story: Meta<MonthSwitchStoryProps> = {
    title: 'Components/MonthSwitch',
    args: { monthName: 'October 2026', onPrevious: fn(), onNext: fn() },
    argTypes: {
        monthName: { control: 'text' },
        onPrevious: { table: { disable: true } },
        onNext: { table: { disable: true } },
    },
};

export const Playground = (args: MonthSwitchStoryProps) => {
    return <MonthSwitch {...args} labels={{ previous: 'Previous month', next: 'Next month' }} />;
};

export default Story;
