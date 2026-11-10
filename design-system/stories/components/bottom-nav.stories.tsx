import { BottomNav as BottomNavComponent, type BottomNavProps } from '@/components/bottom-nav/bottom-nav';
import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { createContext, use, useState, type ReactNode } from 'react';

import type { Meta } from '@storybook/react-vite';

interface RouterFrameProps {
    children: ReactNode;
}

const FrameContext = createContext<ReactNode>(null);

const FrameOutlet = () => use(FrameContext);

// The smallest router that has a route for each tab to point at. The root route shows the children of the latest render.
const RouterFrame = (props: RouterFrameProps) => {
    const { children } = props;
    const [router] = useState(() => {
        const root = createRootRoute({ component: FrameOutlet });
        const pages = ['/groups', '/summary', '/settings'].map((path) => {
            return createRoute({ getParentRoute: () => root, path });
        });

        return createRouter({
            routeTree: root.addChildren(pages),
            history: createMemoryHistory({ initialEntries: ['/'] }),
        });
    });

    return (
        <FrameContext value={children}>
            <RouterProvider router={router} />
        </FrameContext>
    );
};

const Story: Meta<BottomNavProps> = {
    title: 'Components/BottomNav',
    parameters: { layout: 'fullscreen' },
    args: {
        label: 'Main',
        items: [
            { to: '/', label: 'Expenses', icon: 'receipt_long', current: true },
            { to: '/groups', label: 'Groups', icon: 'groups', current: false },
            { to: '/summary', label: 'Summary', icon: 'bar_chart', current: false },
            { to: '/settings', label: 'Settings', icon: 'settings', current: false },
        ],
        action: { label: 'Add an expense', icon: 'add', onPress: () => undefined },
    },
    argTypes: {
        label: { control: 'text' },
        action: { control: 'object' },
    },
};

export const BottomNav = (args: BottomNavProps) => {
    return (
        <RouterFrame>
            <BottomNavComponent {...args} />
        </RouterFrame>
    );
};

export default Story;
