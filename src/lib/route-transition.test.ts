import { describe, expect, it } from 'vitest';

import { navSection, routeDepth, slideTypes } from './route-transition';

function at(pathname: string) {
    return { pathname } as never;
}

function between(from: string | undefined, to: string, pathChanged = true) {
    return slideTypes({ fromLocation: from === undefined ? undefined : at(from), toLocation: at(to), pathChanged });
}

describe('routeDepth', () => {
    it('puts the home screen at the bottom, settings and the summary above it and categories above settings', () => {
        expect(routeDepth('/')).toBe(0);
        expect(routeDepth('/settings')).toBe(1);
        expect(routeDepth('/summary')).toBe(1);
        expect(routeDepth('/categories')).toBe(2);
        expect(routeDepth('/charts')).toBe(2);
    });

    it('takes a page it does not know for the home screen', () => {
        expect(routeDepth('/nowhere')).toBe(0);
    });
});

describe('navSection', () => {
    it('gives each screen of the header its own section and a deeper screen the one it is reached from', () => {
        expect(navSection('/')).toBe('/');
        expect(navSection('/summary')).toBe('/summary');
        expect(navSection('/charts')).toBe('/summary');
        expect(navSection('/settings')).toBe('/settings');
        expect(navSection('/categories')).toBe('/settings');
    });

    it('takes a page it does not know for the home screen', () => {
        expect(navSection('/nowhere')).toBe('/');
    });
});

describe('slideTypes', () => {
    it('goes forward when the new screen is deeper', () => {
        expect(between('/', '/settings')).toEqual(['forward']);
        expect(between('/settings', '/categories')).toEqual(['forward']);
        expect(between('/', '/categories')).toEqual(['forward']);
        expect(between('/', '/summary')).toEqual(['forward']);
        expect(between('/summary', '/charts')).toEqual(['forward']);
    });

    it('goes back when the new screen is shallower', () => {
        expect(between('/settings', '/')).toEqual(['back']);
        expect(between('/categories', '/settings')).toEqual(['back']);
        expect(between('/categories', '/')).toEqual(['back']);
        expect(between('/summary', '/')).toEqual(['back']);
        expect(between('/charts', '/summary')).toEqual(['back']);
    });

    it('stays level between two screens at the same depth', () => {
        expect(between('/summary', '/settings')).toEqual(['level']);
        expect(between('/settings', '/summary')).toEqual(['level']);
        expect(between('/charts', '/categories')).toEqual(['level']);
        expect(between('/categories', '/charts')).toEqual(['level']);
    });

    it('does not slide for the first screen, for the same screen or for a change that is not of path', () => {
        expect(between(undefined, '/settings')).toBe(false);
        expect(between('/settings', '/settings')).toBe(false);
        expect(between('/settings', '/settings', false)).toBe(false);
        expect(between('/', '/settings', false)).toBe(false);
    });
});
