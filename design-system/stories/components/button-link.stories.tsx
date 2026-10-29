import { ButtonLink } from '@/components/button/button-link';
import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

// The smallest router that has a route for `to` to point at. It keeps the children it first got.
function RouterFrame(props: { children: ReactNode }) {
    const { children } = props;
    const [router] = useState(() => {
        const root = createRootRoute({ component: () => children });
        const categories = createRoute({ getParentRoute: () => root, path: '/categories' });
        return createRouter({
            routeTree: root.addChildren([categories]),
            history: createMemoryHistory({ initialEntries: ['/'] }),
        });
    });

    return <RouterProvider router={router} />;
}

const meta = {
    title: 'Components/ButtonLink',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {
    render: () => (
        <RouterFrame>
            <ButtonLink to="/categories">Categories</ButtonLink>
        </RouterFrame>
    ),
};

const Primary: Story = {
    render: () => (
        <RouterFrame>
            <ButtonLink to="/categories" variant="primary">
                Categories
            </ButtonLink>
        </RouterFrame>
    ),
};

const Glyph: Story = {
    render: () => (
        <RouterFrame>
            <ButtonLink to="/categories" glyph aria-label="Categories">
                →
            </ButtonLink>
        </RouterFrame>
    ),
};

export default meta;
export { Default, Glyph, Primary };
