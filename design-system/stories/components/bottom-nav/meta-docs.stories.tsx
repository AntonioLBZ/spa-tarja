import { BottomNav } from '@/components/bottom-nav/bottom-nav';
import { SampleFrame } from '@stories/shared/frame';
import { RouterFrame } from '@stories/shared/router-frame';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/BottomNav/Examples',
    component: BottomNav,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
    decorators: [
        (Story) => (
            <SampleFrame>
                <RouterFrame paths={['/groups', '/summary', '/settings']}>
                    <Story />
                </RouterFrame>
            </SampleFrame>
        ),
    ],
};

export const Basic = () => {
    return (
        <BottomNav
            label="Main"
            items={[
                { to: '/', label: 'Expenses', icon: 'receipt_long', current: true },
                { to: '/groups', label: 'Groups', icon: 'groups', current: false },
                { to: '/summary', label: 'Summary', icon: 'bar_chart', current: false },
                { to: '/settings', label: 'Settings', icon: 'settings', current: false },
            ]}
            action={{ label: 'Add expense', word: 'Add', icon: 'add', onPress: () => undefined }}
        />
    );
};

export const NoneCurrent = () => {
    return (
        <BottomNav
            label="Main"
            items={[
                { to: '/', label: 'Expenses', icon: 'receipt_long', current: false },
                { to: '/groups', label: 'Groups', icon: 'groups', current: false },
                { to: '/summary', label: 'Summary', icon: 'bar_chart', current: false },
                { to: '/settings', label: 'Settings', icon: 'settings', current: false },
            ]}
            action={{ label: 'Add expense', word: 'Add', icon: 'add', onPress: () => undefined }}
        />
    );
};

export default Story;
