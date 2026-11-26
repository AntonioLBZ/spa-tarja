import { BottomNav, type BottomNavItem } from '@/components/bottom-nav/bottom-nav';
import { RouterFrame } from '@stories/shared/router-frame';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

type Destination = 'Expenses' | 'Groups' | 'Summary' | 'Settings';

interface BottomNavStoryProps {
    label: string;
    /** The tab of the screen shown, or none on a screen that isn't one of them */
    current: Destination | 'none';
    /** Whether the "+" is in the middle */
    withAction: boolean;
    onPress: () => void;
}

const DESTINATIONS: readonly Omit<BottomNavItem, 'current'>[] = [
    { to: '/', label: 'Expenses', icon: 'receipt_long' },
    { to: '/groups', label: 'Groups', icon: 'groups' },
    { to: '/summary', label: 'Summary', icon: 'bar_chart' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
];

const Story: Meta<BottomNavStoryProps> = {
    title: 'Components/BottomNav',
    parameters: { layout: 'fullscreen' },
    globals: { viewport: { value: 'phone' } },
    args: { label: 'Main', current: 'Expenses', withAction: true, onPress: fn() },
    argTypes: {
        label: { control: 'text' },
        current: { control: 'inline-radio', options: ['none', ...DESTINATIONS.map((item) => item.label)] },
        onPress: { table: { disable: true } },
    },
};

export const Playground = (args: BottomNavStoryProps) => {
    const { label, current, withAction, onPress } = args;
    const items = DESTINATIONS.map((item) => ({ ...item, current: item.label === current }));
    const action = withAction ? { label: 'Add expense', word: 'Add', icon: 'add' as const, onPress } : undefined;

    return (
        <RouterFrame paths={['/groups', '/summary', '/settings']}>
            <BottomNav label={label} items={items} action={action} />
        </RouterFrame>
    );
};

export default Story;
