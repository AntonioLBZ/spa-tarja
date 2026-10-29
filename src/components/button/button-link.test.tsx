import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { type ComponentProps, type ReactElement } from 'react';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ButtonLink } from './button-link';

async function renderInRouter(element: ReactElement) {
    const root = createRootRoute({ component: () => element });
    const categories = createRoute({ getParentRoute: () => root, path: '/categories' });
    const router = createRouter({
        routeTree: root.addChildren([categories]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    render(<RouterProvider router={router} />);
    return screen.findByRole('link');
}

describe('ButtonLink', () => {
    it('is a link that looks like a button', async () => {
        const link = await renderInRouter(<ButtonLink to="/categories">Categories</ButtonLink>);

        expect(link.tagName).toBe('A');
        expect(link.getAttribute('href')).toBe('/categories');
        expect(link.className).toBe('button');
        expect(link.textContent).toBe('Categories');
    });

    it('takes the variant and the class of the call site', async () => {
        const link = await renderInRouter(
            <ButtonLink to="/categories" variant="primary" className="toolbar__link">
                Categories
            </ButtonLink>
        );

        expect(link.className).toBe('button button--primary toolbar__link');
    });

    it('draws a glyph in a box with even padding and is named by its label', async () => {
        const link = await renderInRouter(
            <ButtonLink to="/categories" glyph aria-label="Categories">
                →
            </ButtonLink>
        );

        expect(link.className).toBe('button button--glyph');
        expect(screen.getByRole('link', { name: 'Categories' })).toBe(link);
    });

    it('asks a glyph for a name, since its text says nothing', () => {
        type Props = ComponentProps<typeof ButtonLink>;

        expectTypeOf<{ to: '/categories'; glyph: true; 'aria-label': string }>().toExtend<Props>();
        expectTypeOf<{ to: '/categories'; glyph: true }>().not.toExtend<Props>();
        expectTypeOf<{ to: '/categories'; glyph?: false }>().toExtend<Props>();
    });
});
