import { TabLink } from '@/components/tab/tab-link';
import { RouterFrame } from '@stories/shared/router-frame';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/TabLink/Examples',
    component: TabLink,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
    decorators: [
        (Story) => (
            <RouterFrame paths={['/groups/$groupId']}>
                <Story />
            </RouterFrame>
        ),
    ],
};

export const Basic = () => {
    return (
        <nav className="story-tabs">
            <TabLink to="/" activeOptions={{ exact: true }}>
                Expenses
            </TabLink>
            <TabLink to="/groups/$groupId" params={{ groupId: 'flat' }}>
                Flat
            </TabLink>
        </nav>
    );
};

export const LongName = () => {
    return (
        <nav className="story-tabs">
            <TabLink to="/" activeOptions={{ exact: true }}>
                Expenses
            </TabLink>
            <TabLink to="/groups/$groupId" params={{ groupId: 'flat' }}>
                Flat
            </TabLink>
            <TabLink to="/groups/$groupId" params={{ groupId: 'lisbon' }}>
                Lisbon trip with the whole family
            </TabLink>
        </nav>
    );
};

export default Story;
