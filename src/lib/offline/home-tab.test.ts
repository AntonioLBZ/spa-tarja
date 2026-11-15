import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHomeTab, forgetHomeTab, readHomeTab, rememberHomeTab } from './home-tab';

beforeEach(() => {
    localStorage.clear();
});

describe('the tab shown last', () => {
    it('is kept for each user apart from any other on the device', () => {
        rememberHomeTab('ana', 'trip');
        rememberHomeTab('bea', 'flat');

        expect(readHomeTab('ana')).toBe('trip');
        expect(readHomeTab('bea')).toBe('flat');
        expect(localStorage.getItem('tarja:home-tab:ana')).toBe('trip');
    });

    it('is nothing for Expenses, and is forgotten for that user only', () => {
        rememberHomeTab('ana', 'trip');
        rememberHomeTab('bea', 'flat');

        rememberHomeTab('ana', null);
        forgetHomeTab('bea');

        expect(readHomeTab('ana')).toBeNull();
        expect(readHomeTab('bea')).toBeNull();
    });
});

describe('the tab the Expenses screen opens on', () => {
    it('is the one shown last, once per load', () => {
        rememberHomeTab('ana', 'trip');
        const homeTab = createHomeTab('ana');

        expect(homeTab.follow(undefined, null)).toBe('trip');
        expect(homeTab.follow(undefined, null)).toBeNull();
        expect(readHomeTab('ana')).toBe('trip');
        expect(homeTab.follow('trip', 'trip')).toBeNull();
        expect(homeTab.follow(undefined, null)).toBeNull();
        expect(readHomeTab('ana')).toBeNull();
    });

    it('is the one the address names, when it names one', () => {
        rememberHomeTab('ana', 'trip');
        const homeTab = createHomeTab('ana');

        expect(homeTab.follow('flat', 'flat')).toBeNull();
        expect(readHomeTab('ana')).toBe('flat');
    });

    it('is Expenses with nothing kept, and follows the tabs after', () => {
        const homeTab = createHomeTab('ana');

        expect(homeTab.follow(undefined, null)).toBeNull();
        expect(homeTab.follow('flat', null)).toBeNull();
        expect(readHomeTab('ana')).toBeNull();
        expect(homeTab.follow('flat', 'flat')).toBeNull();
        expect(readHomeTab('ana')).toBe('flat');
    });

    it('falls back to Expenses for a tab that is gone, and forgets it', () => {
        rememberHomeTab('ana', 'gone');
        const homeTab = createHomeTab('ana');

        expect(homeTab.follow(undefined, null)).toBe('gone');
        expect(homeTab.follow('gone', null)).toBeNull();
        expect(readHomeTab('ana')).toBe('gone');
        expect(homeTab.follow(undefined, null)).toBeNull();
        expect(readHomeTab('ana')).toBeNull();
    });

    it('says the tab shown last to whoever listens, as it changes', () => {
        rememberHomeTab('ana', 'trip');
        const homeTab = createHomeTab('ana');
        const listener = vi.fn();
        homeTab.subscribe(listener);

        expect(homeTab.last()).toBe('trip');
        homeTab.follow('flat', 'flat');
        homeTab.follow('flat', 'flat');

        expect(homeTab.last()).toBe('flat');
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
