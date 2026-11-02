import type { ParsedLocation } from '@tanstack/react-router';

// How deep a screen sits in the app: moving to a deeper one slides forward, to a shallower one slides back
const DEPTHS: Record<string, number> = {
    '/': 0,
    '/settings': 1,
    '/summary': 1,
    '/groups': 1,
    '/categories': 2,
    '/charts': 2,
    '/budgets': 2,
};

// The screens of one group, by the shape of their path
const GROUP_DEPTHS: ReadonlyArray<readonly [RegExp, number]> = [[/^\/groups\/[^/]+$/, 2]];

const routeDepth = (pathname: string): number => {
    return DEPTHS[pathname] ?? GROUP_DEPTHS.find(([shape]) => shape.test(pathname))?.[1] ?? 0;
};

type NavSection = '/' | '/groups' | '/summary' | '/settings';

// The header word a screen falls under, which carries the underline: a deeper screen falls under the one it is reached
// from
const SECTIONS: Record<string, NavSection> = {
    '/groups': '/groups',
    '/summary': '/summary',
    '/charts': '/summary',
    '/budgets': '/summary',
    '/settings': '/settings',
    '/categories': '/settings',
};

const navSection = (pathname: string): NavSection => {
    return SECTIONS[pathname] ?? (pathname.startsWith('/groups/') ? '/groups' : '/');
};

interface LocationChange {
    fromLocation?: ParsedLocation;
    toLocation: ParsedLocation;
    pathChanged: boolean;
}

// The view transition types of a navigation, which the styles turn into a slide, or a fade between two screens at the
// same depth; false for no transition
const slideTypes = (change: LocationChange): string[] | false => {
    const { fromLocation, toLocation, pathChanged } = change;
    if (!fromLocation || !pathChanged) return false;
    const from = routeDepth(fromLocation.pathname);
    const to = routeDepth(toLocation.pathname);
    if (from === to) return ['level'];
    return [to > from ? 'forward' : 'back'];
};

export { navSection, routeDepth, slideTypes, type NavSection };
