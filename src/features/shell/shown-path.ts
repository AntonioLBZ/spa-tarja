import { useRouterState } from '@tanstack/react-router';

import { navSection } from '@/lib/route-transition';

// The path of the screen already shown, not of the one being opened: a bar has to be in its old state when the view
// transition takes its first picture, and changes inside it
const useShownPathname = () => {
    return useRouterState({ select: (state) => (state.resolvedLocation ?? state.location).pathname });
};

const useSection = () => {
    return navSection(useShownPathname());
};

export { useSection, useShownPathname };
