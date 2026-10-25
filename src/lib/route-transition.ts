import type { ParsedLocation } from '@tanstack/react-router';

// How deep a screen sits in the app: moving to a deeper one slides forward, to a shallower one slides back
const DEPTHS: Record<string, number> = { '/': 0, '/settings': 1, '/summary': 1, '/categories': 2, '/charts': 2 };

function routeDepth(pathname: string): number {
    return DEPTHS[pathname] ?? 0;
}

interface LocationChange {
    fromLocation?: ParsedLocation;
    toLocation: ParsedLocation;
    pathChanged: boolean;
}

// The view transition types of a navigation, which the styles turn into a slide (design.md); false for no transition
function slideTypes(change: LocationChange): string[] | false {
    const { fromLocation, toLocation, pathChanged } = change;
    if (!fromLocation || !pathChanged) return false;
    const from = routeDepth(fromLocation.pathname);
    const to = routeDepth(toLocation.pathname);
    if (from === to) return false;
    return [to > from ? 'forward' : 'back'];
}

export { routeDepth, slideTypes };
