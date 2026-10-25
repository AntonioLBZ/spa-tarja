import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { renderApp, stubApi } from '@/lib/test/render-app';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('home', () => {
    it('shows the API as operational when the health check passes', async () => {
        stubApi((url) =>
            url.pathname === '/api/health' ? Response.json({ ok: true }) : new Response(null, { status: 404 })
        );

        renderApp();

        expect(await screen.findByText(en.home.health.ok)).toBeDefined();
    });

    it('shows the API as unreachable when the health check fails', async () => {
        stubApi(() => new Response(null, { status: 500 }));

        renderApp();

        expect(await screen.findByText(en.home.health.error)).toBeDefined();
    });
});
