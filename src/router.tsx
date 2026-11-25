import { createRouter, type RouterHistory } from '@tanstack/react-router';

import { slideTypes, takeSkippedSlide, type LocationChange } from './lib/navigation';
import { routeTree } from './routeTree.gen';

const createAppRouter = (history?: RouterHistory) => {
    return createRouter({
        routeTree,
        history,
        defaultPreload: 'intent',
        scrollRestoration: true,
        defaultViewTransition: {
            types: (change: LocationChange) => (takeSkippedSlide() ? false : slideTypes(change)),
        },
    });
};

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createAppRouter>;
    }
}

export { createAppRouter };
