import { type ButtonProps, type GlyphName } from '@/components/button/button';
import { ButtonLink as ButtonLinkComponent } from '@/components/button/button-link';
import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { createContext, use, useState, type ReactNode } from 'react';

import type { Meta } from '@storybook/react-vite';

type ButtonLinkArgs = Pick<ButtonProps, 'variant' | 'children'> & GlyphName;

interface RouterFrameProps {
    children: ReactNode;
}

const FrameContext = createContext<ReactNode>(null);

const FrameOutlet = () => use(FrameContext);

// The smallest router that has a route for `to` to point at. The root route shows the children of the latest render.
const RouterFrame = (props: RouterFrameProps) => {
    const { children } = props;
    const [router] = useState(() => {
        const root = createRootRoute({ component: FrameOutlet });
        const categories = createRoute({ getParentRoute: () => root, path: '/categories' });

        return createRouter({
            routeTree: root.addChildren([categories]),
            history: createMemoryHistory({ initialEntries: ['/'] }),
        });
    });

    return (
        <FrameContext value={children}>
            <RouterProvider router={router} />
        </FrameContext>
    );
};

const Story: Meta<ButtonLinkArgs> = {
    title: 'Components/ButtonLink',
    args: { children: 'Categories', variant: 'default', glyph: false },
    argTypes: {
        children: { control: 'text' },
        variant: { control: 'inline-radio', options: ['default', 'primary', 'danger'] },
    },
};

export const ButtonLink = (args: ButtonLinkArgs) => {
    return (
        <RouterFrame>
            <ButtonLinkComponent to="/categories" {...args} />
        </RouterFrame>
    );
};

export default Story;
