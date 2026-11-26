import { TabLink } from '@/components/tab/tab-link';
import { RouterFrame } from '@stories/shared/router-frame';

import type { Meta } from '@storybook/react-vite';

interface TabLinkStoryProps {
    /** The words of the first and of the second tab */
    first: string;
    second: string;
    /** Which of the two is the screen shown */
    current: 'first' | 'second';
}

const Story: Meta<TabLinkStoryProps> = {
    title: 'Components/TabLink',
    args: { first: 'Expenses', second: 'Flat', current: 'first' },
    argTypes: {
        first: { control: 'text' },
        second: { control: 'text' },
        current: { control: 'inline-radio', options: ['first', 'second'] },
    },
};

export const Playground = (args: TabLinkStoryProps) => {
    const { first, second, current } = args;

    return (
        <RouterFrame key={current} paths={['/groups']} at={current === 'first' ? '/' : '/groups'}>
            <nav className="story-tabs">
                <TabLink to="/" activeOptions={{ exact: true }}>
                    {first}
                </TabLink>
                <TabLink to="/groups">{second}</TabLink>
            </nav>
        </RouterFrame>
    );
};

export default Story;
