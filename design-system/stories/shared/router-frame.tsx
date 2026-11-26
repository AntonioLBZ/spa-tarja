import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { createContext, use, useState, type ReactNode } from 'react';

interface RouterFrameProps {
    // The paths a link may point at, besides `/`
    paths: readonly string[];
    // Where the history starts, so a link to it is the current one
    at?: string;
    children: ReactNode;
}

const FrameContext = createContext<ReactNode>(null);

const FrameOutlet = () => use(FrameContext);

// The smallest router with a route for each path. The root route shows the children of the latest render.
const RouterFrame = (props: RouterFrameProps) => {
    const { paths, at = '/', children } = props;
    const [router] = useState(() => {
        const root = createRootRoute({ component: FrameOutlet });
        const routes = paths.map((path) => createRoute({ getParentRoute: () => root, path }));

        return createRouter({
            routeTree: root.addChildren(routes),
            history: createMemoryHistory({ initialEntries: [at] }),
        });
    });

    return (
        <FrameContext value={children}>
            <RouterProvider router={router} />
        </FrameContext>
    );
};

export { RouterFrame, type RouterFrameProps };
