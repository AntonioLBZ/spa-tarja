import { createRouter, type RouterHistory } from '@tanstack/react-router';

import { slideTypes } from './lib/route-transition';
import { routeTree } from './routeTree.gen';

function createAppRouter(history?: RouterHistory) {
    return createRouter({
        routeTree,
        history,
        defaultPreload: 'intent',
        scrollRestoration: true,
        defaultViewTransition: { types: slideTypes },
    });
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createAppRouter>;
    }
}

export { createAppRouter };
