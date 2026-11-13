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

const GROUP_PATH = /^\/groups\/[^/]+$/;
const GROUP_SETTINGS_PATH = /^\/groups\/([^/]+)\/edit$/;

// The screens of one group, and the page of an invitation, by the shape of their path
const PATH_DEPTHS: ReadonlyArray<readonly [RegExp, number]> = [
    [GROUP_PATH, 2],
    [GROUP_SETTINGS_PATH, 3],
    [/^\/join\/[^/]+$/, 1],
];

const routeDepth = (pathname: string): number => {
    return DEPTHS[pathname] ?? PATH_DEPTHS.find(([shape]) => shape.test(pathname))?.[1] ?? 0;
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
    const underGroups = pathname.startsWith('/groups/') || pathname.startsWith('/join/');
    return SECTIONS[pathname] ?? (underGroups ? '/groups' : '/');
};

type BackTarget = { to: NavSection } | { to: '/groups/$groupId'; params: { groupId: string } };

// Where the link back of a screen deeper than a tab leads: its parent, whatever the history, so it is the same after
// the screen was opened from a link. A group's settings lead to the group; the others to the tab they fall under.
const backTarget = (pathname: string): BackTarget | undefined => {
    if (routeDepth(pathname) < 2) return undefined;
    const groupId = GROUP_SETTINGS_PATH.exec(pathname)?.[1];
    return groupId ? { to: '/groups/$groupId', params: { groupId } } : { to: navSection(pathname) };
};

interface LocationChange {
    fromLocation?: ParsedLocation;
    toLocation: ParsedLocation;
    pathChanged: boolean;
}

// The sections in the order of the bar, which a change of section slides along
const SECTION_ORDER: readonly NavSection[] = ['/', '/groups', '/summary', '/settings'];

// The view transition types of a navigation, which the styles turn into a slide: `next` and `previous` between two
// sections, in the order of the bar; `forward` and `back` to a deeper or shallower screen of the same section; `level`,
// a fade, between two screens of one section at the same depth. False for no transition.
const slideTypes = (change: LocationChange): string[] | false => {
    const { fromLocation, toLocation, pathChanged } = change;
    if (!fromLocation || !pathChanged) return false;
    const fromSection = SECTION_ORDER.indexOf(navSection(fromLocation.pathname));
    const toSection = SECTION_ORDER.indexOf(navSection(toLocation.pathname));
    if (fromSection !== toSection) return [toSection > fromSection ? 'next' : 'previous'];
    const from = routeDepth(fromLocation.pathname);
    const to = routeDepth(toLocation.pathname);
    if (from === to) return ['level'];
    return [to > from ? 'forward' : 'back'];
};

export { backTarget, navSection, routeDepth, slideTypes, type BackTarget, type NavSection };
