import { TabLink as TabLinkComponent } from '@/components/tab/tab-link';
import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { createContext, use, useState, type ReactNode } from 'react';

import type { Meta } from '@storybook/react-vite';

interface TabLinkArgs {
    current: string;
    other: string;
}

interface RouterFrameProps {
    children: ReactNode;
}

const FrameContext = createContext<ReactNode>(null);

const FrameOutlet = () => use(FrameContext);

// The smallest router with two screens for the tabs to point at; the first is the one shown
const RouterFrame = (props: RouterFrameProps) => {
    const { children } = props;
    const [router] = useState(() => {
        const root = createRootRoute({ component: FrameOutlet });
        const groups = createRoute({ getParentRoute: () => root, path: '/groups' });

        return createRouter({
            routeTree: root.addChildren([groups]),
            history: createMemoryHistory({ initialEntries: ['/'] }),
        });
    });

    return (
        <FrameContext value={children}>
            <RouterProvider router={router} />
        </FrameContext>
    );
};

const Story: Meta<TabLinkArgs> = {
    title: 'Components/TabLink',
    args: { current: 'Expenses', other: 'A flat shared with a very long name' },
};

// A row of tabs as the pinned groups draw it: the current one and one whose name is cut
export const TabLink = (args: TabLinkArgs) => {
    const { current, other } = args;

    return (
        <RouterFrame>
            <nav style={{ display: 'flex', gap: '1rem', maxInlineSize: '20rem' }}>
                <TabLinkComponent to="/" activeOptions={{ exact: true }} style={{ flexShrink: 0 }}>
                    {current}
                </TabLinkComponent>
                <TabLinkComponent to="/groups">{other}</TabLinkComponent>
            </nav>
        </RouterFrame>
    );
};

export default Story;
