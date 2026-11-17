import { describe, expect, it } from 'vitest';

import { backTarget, navSection, routeDepth, slideTypes, swipeTarget, type SwipeFrom } from './route-transition';

function at(pathname: string) {
    return { pathname } as never;
}

function between(from: string | undefined, to: string) {
    return slideTypes({
        fromLocation: from === undefined ? undefined : at(from),
        toLocation: at(to),
        pathChanged: from !== to,
    });
}

describe('routeDepth', () => {
    it('puts the home screen at the bottom, settings and the summary above it and the pages of settings above settings', () => {
        expect(routeDepth('/')).toBe(0);
        expect(routeDepth('/settings')).toBe(1);
        expect(routeDepth('/summary')).toBe(1);
        expect(routeDepth('/groups')).toBe(1);
        expect(routeDepth('/settings/appearance')).toBe(2);
        expect(routeDepth('/settings/categories')).toBe(2);
        expect(routeDepth('/settings/account')).toBe(2);
        expect(routeDepth('/charts')).toBe(2);
        expect(routeDepth('/budgets')).toBe(2);
    });

    it('puts a group above Groups and its settings above the group', () => {
        expect(routeDepth('/groups/0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f')).toBe(2);
        expect(routeDepth('/groups/0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f/edit')).toBe(3);
    });

    it('puts the page of an invitation level with Groups', () => {
        expect(routeDepth('/join/0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.token')).toBe(1);
        expect(routeDepth('/join/a/b')).toBe(0);
    });

    it('takes a page it does not know for the home screen', () => {
        expect(routeDepth('/nowhere')).toBe(0);
        expect(routeDepth('/groups/a/b/c')).toBe(0);
    });
});

describe('navSection', () => {
    it('gives each screen of the header its own section and a deeper screen the one it is reached from', () => {
        expect(navSection('/')).toBe('/');
        expect(navSection('/groups')).toBe('/groups');
        expect(navSection('/summary')).toBe('/summary');
        expect(navSection('/charts')).toBe('/summary');
        expect(navSection('/budgets')).toBe('/summary');
        expect(navSection('/settings')).toBe('/settings');
        expect(navSection('/settings/appearance')).toBe('/settings');
        expect(navSection('/settings/categories')).toBe('/settings');
        expect(navSection('/settings/account')).toBe('/settings');
    });

    it('puts a group, its settings and the page of an invitation under Groups', () => {
        expect(navSection('/join/0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.token')).toBe('/groups');
        expect(navSection('/groups/0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f')).toBe('/groups');
        expect(navSection('/groups/0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f/edit')).toBe('/groups');
    });

    it('takes a page it does not know for the home screen', () => {
        expect(navSection('/nowhere')).toBe('/');
    });
});

describe('backTarget', () => {
    const group = '0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f';

    it('leads a screen below a tab to the tab it is reached from', () => {
        expect(backTarget('/settings/appearance')).toEqual({ to: '/settings' });
        expect(backTarget('/settings/categories')).toEqual({ to: '/settings' });
        expect(backTarget('/settings/account')).toEqual({ to: '/settings' });
        expect(backTarget('/charts')).toEqual({ to: '/summary' });
        expect(backTarget('/budgets')).toEqual({ to: '/summary' });
        expect(backTarget(`/groups/${group}`)).toEqual({ to: '/groups' });
        expect(backTarget('/groups/new')).toEqual({ to: '/groups' });
    });

    it('leads the settings of a group to the group of the address', () => {
        expect(backTarget(`/groups/${group}/edit`)).toEqual({ to: '/groups/$groupId', params: { groupId: group } });
    });

    it('leads nowhere from the home screen, the tabs, the page of an invitation and a page it does not know', () => {
        for (const pathname of ['/', '/groups', '/summary', '/settings', `/join/${group}.token`, '/nowhere']) {
            expect(backTarget(pathname)).toBeUndefined();
        }
    });

    it('gives one to every screen deeper than a tab and to no other', () => {
        const paths = ['/', '/settings', '/summary', '/groups', '/settings/account', '/charts', '/budgets'];
        paths.push(`/groups/${group}`, `/groups/${group}/edit`, `/join/${group}.token`);

        for (const pathname of paths) {
            expect(backTarget(pathname) !== undefined).toBe(routeDepth(pathname) >= 2);
        }
    });

    it.each([
        '/settings/appearance',
        '/settings/categories',
        '/settings/account',
        '/charts',
        '/budgets',
        `/groups/${group}`,
        `/groups/${group}/edit`,
    ])('slides back from %s, since the parent is shallower', (pathname) => {
        const target = backTarget(pathname)!;
        const parent = 'params' in target ? `/groups/${target.params.groupId}` : target.to;

        expect(between(pathname, parent)).toEqual(['back']);
    });
});

describe('slideTypes', () => {
    it('slides along the bar between two sections', () => {
        expect(between('/', '/groups')).toEqual(['next']);
        expect(between('/', '/settings')).toEqual(['next']);
        expect(between('/groups', '/summary')).toEqual(['next']);
        expect(between('/summary', '/settings')).toEqual(['next']);
        expect(between('/', '/settings/categories')).toEqual(['next']);
        expect(between('/groups/0b6f3c1e', '/charts')).toEqual(['next']);
        expect(between('/settings', '/summary')).toEqual(['previous']);
        expect(between('/settings', '/groups')).toEqual(['previous']);
        expect(between('/summary', '/')).toEqual(['previous']);
        expect(between('/settings/categories', '/')).toEqual(['previous']);
        expect(between('/charts', '/settings/categories')).toEqual(['next']);
        expect(between('/settings/categories', '/charts')).toEqual(['previous']);
    });

    it('goes forward when the new screen is deeper in the same section', () => {
        expect(between('/settings', '/settings/categories')).toEqual(['forward']);
        expect(between('/summary', '/charts')).toEqual(['forward']);
        expect(between('/summary', '/budgets')).toEqual(['forward']);
        expect(between('/groups', '/groups/0b6f3c1e')).toEqual(['forward']);
        expect(between('/groups/0b6f3c1e', '/groups/0b6f3c1e/edit')).toEqual(['forward']);
    });

    it('goes back when the new screen is shallower in the same section', () => {
        expect(between('/settings/categories', '/settings')).toEqual(['back']);
        expect(between('/charts', '/summary')).toEqual(['back']);
        expect(between('/budgets', '/summary')).toEqual(['back']);
        expect(between('/groups/0b6f3c1e', '/groups')).toEqual(['back']);
        expect(between('/groups/0b6f3c1e/edit', '/groups/0b6f3c1e')).toEqual(['back']);
    });

    it('stays level between two screens of one section at the same depth', () => {
        expect(between('/charts', '/budgets')).toEqual(['level']);
        expect(between('/budgets', '/charts')).toEqual(['level']);
        expect(between('/settings/appearance', '/settings/account')).toEqual(['level']);
        expect(between('/groups/0b6f3c1e', '/groups/7d2a9e40')).toEqual(['level']);
    });

    it('does not slide for the first screen, nor for a change inside the same screen', () => {
        expect(between(undefined, '/settings')).toBe(false);
        expect(between('/settings', '/settings')).toBe(false);
        expect(between('/', '/')).toBe(false);
    });
});

describe('swipeTarget', () => {
    const from = (pathname: string, more: Partial<SwipeFrom> = {}): SwipeFrom => {
        return { pathname, shown: null, pinned: [], lastHomeTab: null, ...more };
    };

    it('moves along the sections in the order of the bar', () => {
        expect(swipeTarget(from('/'), 'next')).toEqual({ to: '/groups', group: null, types: ['next'] });
        expect(swipeTarget(from('/groups'), 'next')).toEqual({ to: '/summary', group: null, types: ['next'] });
        expect(swipeTarget(from('/summary'), 'next')).toEqual({ to: '/settings', group: null, types: ['next'] });
        expect(swipeTarget(from('/settings'), 'previous')).toEqual({
            to: '/summary',
            group: null,
            types: ['previous'],
        });
        expect(swipeTarget(from('/groups'), 'previous')).toEqual({ to: '/', group: null, types: ['previous'] });
    });

    it('stops at both ends', () => {
        expect(swipeTarget(from('/'), 'previous')).toBeUndefined();
        expect(swipeTarget(from('/settings'), 'next')).toBeUndefined();
    });

    it('goes through the pinned tabs of Expenses before Groups, sliding only the screen under them', () => {
        const pinned = ['a', 'b'];

        expect(swipeTarget(from('/', { pinned }), 'next')).toEqual({ to: '/', group: 'a', types: ['next', 'tabs'] });
        expect(swipeTarget(from('/', { pinned, shown: 'a' }), 'next')).toEqual({
            to: '/',
            group: 'b',
            types: ['next', 'tabs'],
        });
        expect(swipeTarget(from('/', { pinned, shown: 'b' }), 'next')).toEqual({
            to: '/groups',
            group: null,
            types: ['next'],
        });
        expect(swipeTarget(from('/', { pinned, shown: 'a' }), 'previous')).toEqual({
            to: '/',
            group: null,
            types: ['previous', 'tabs'],
        });
        expect(swipeTarget(from('/', { pinned }), 'previous')).toBeUndefined();
    });

    it('comes back to Expenses on the tab shown last, as the bar does, while it is still pinned', () => {
        const pinned = ['a', 'b'];

        expect(swipeTarget(from('/groups', { pinned, lastHomeTab: 'a' }), 'previous')).toEqual({
            to: '/',
            group: 'a',
            types: ['previous'],
        });
        expect(swipeTarget(from('/groups', { pinned, lastHomeTab: 'gone' }), 'previous')?.group).toBeNull();
    });

    it('does nothing from a screen below a section or outside the bar', () => {
        for (const pathname of ['/charts', '/settings/account', '/groups/0b6f3c1e', '/join/a.b', '/nowhere']) {
            expect(swipeTarget(from(pathname), 'next')).toBeUndefined();
            expect(swipeTarget(from(pathname), 'previous')).toBeUndefined();
        }
    });
});
