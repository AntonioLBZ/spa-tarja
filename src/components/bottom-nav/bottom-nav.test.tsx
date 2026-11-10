import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BottomNav, type BottomNavAction, type BottomNavItem } from './bottom-nav';

const EXPENSES: BottomNavItem = { to: '/', label: 'Expenses', icon: 'receipt_long', current: true };
const GROUPS: BottomNavItem = { to: '/groups', label: 'Groups', icon: 'groups', current: false };
const SUMMARY: BottomNavItem = { to: '/summary', label: 'Summary', icon: 'bar_chart', current: false };
const SETTINGS: BottomNavItem = { to: '/settings', label: 'Settings', icon: 'settings', current: false };
const ITEMS = [EXPENSES, GROUPS, SUMMARY, SETTINGS];

async function renderNav(items: BottomNavItem[] = ITEMS, path = '/', action?: BottomNavAction) {
    const root = createRootRoute({ component: () => <BottomNav label="Main" items={items} action={action} /> });
    const pages = ['/groups', '/summary', '/settings', '/charts'].map((path) =>
        createRoute({ getParentRoute: () => root, path })
    );
    const router = createRouter({
        routeTree: root.addChildren(pages),
        history: createMemoryHistory({ initialEntries: [path] }),
    });
    render(<RouterProvider router={router} />);
    return screen.findByRole('navigation', { name: 'Main' });
}

describe('BottomNav', () => {
    it('is one navigation named by its label, with a link for each item in order', async () => {
        const nav = await renderNav();

        expect(screen.getAllByRole('navigation')).toHaveLength(1);
        const links = within(nav).getAllByRole('link');
        expect(links.map((link) => link.textContent)).toEqual(ITEMS.map((item) => item.label));
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/groups', '/summary', '/settings']);
    });

    function marked(nav: HTMLElement) {
        return within(nav)
            .getAllByRole('link')
            .filter((link) => link.getAttribute('aria-current') === 'page')
            .map((link) => link.textContent);
    }

    it('marks only the current item', async () => {
        const nav = await renderNav(
            ITEMS.map((item) => ({ ...item, current: item.label === 'Summary' })),
            '/summary'
        );

        expect(marked(nav)).toEqual(['Summary']);
        expect(within(nav).getByRole('link', { name: 'Summary' }).className).toContain('bottom-nav__link--current');
        expect(within(nav).getByRole('link', { name: 'Groups' }).className).not.toContain('bottom-nav__link--current');
    });

    it('marks the item of a deeper screen that is not a link of its own', async () => {
        const nav = await renderNav(
            ITEMS.map((item) => ({ ...item, current: item.label === 'Summary' })),
            '/charts'
        );

        expect(marked(nav)).toEqual(['Summary']);
    });

    it('draws each icon as decoration over its word', async () => {
        const nav = await renderNav();

        within(nav)
            .getAllByRole('link')
            .forEach((link, index) => {
                const icon = link.querySelector('svg')!;
                expect(icon.getAttribute('aria-hidden')).toBe('true');
                expect(icon.getAttribute('data-icon')).toBe(ITEMS[index]?.icon);
                expect(link.textContent).toBe(ITEMS[index]?.label);
            });
    });

    it('tells the item when it is pressed', async () => {
        const onClick = vi.fn();
        const nav = await renderNav([EXPENSES, { ...GROUPS, onClick }, SUMMARY, SETTINGS]);

        fireEvent.click(within(nav).getByRole('link', { name: 'Groups' }));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }));

        expect(() => fireEvent.click(within(nav).getByRole('link', { name: 'Summary' }))).not.toThrow();
    });

    describe('with an action', () => {
        const ADD: BottomNavAction = { label: 'Add', icon: 'add', onPress: vi.fn() };

        it('draws the action in the middle, between the second and the third item', async () => {
            const nav = await renderNav(ITEMS, '/', ADD);

            const names = within(nav)
                .getAllByRole('listitem')
                .map((item) => item.querySelector('a')?.textContent ?? item.querySelector('button')!.ariaLabel);
            expect(names).toEqual(['Expenses', 'Groups', 'Add', 'Summary', 'Settings']);
        });

        it('makes the action a button, not a link, with no mark of a current page', async () => {
            const nav = await renderNav(ITEMS, '/', ADD);

            const button = within(nav).getByRole('button', { name: 'Add' });
            expect(button.hasAttribute('aria-current')).toBe(false);
            expect(button.getAttribute('aria-haspopup')).toBe('dialog');
            expect(button.querySelector('svg')!.getAttribute('data-icon')).toBe('add');
            expect(within(nav).getAllByRole('link')).toHaveLength(4);
        });

        it('calls onPress when the action is pressed', async () => {
            const onPress = vi.fn();
            const nav = await renderNav(ITEMS, '/', { ...ADD, onPress });

            fireEvent.click(within(nav).getByRole('button', { name: 'Add' }));

            expect(onPress).toHaveBeenCalledTimes(1);
        });

        it('draws no button without an action', async () => {
            const nav = await renderNav();

            expect(within(nav).queryByRole('button')).toBeNull();
        });
    });
});
