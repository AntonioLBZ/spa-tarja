import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';
import { stubApi } from '@/lib/test/render-app';

import { createAuthService } from './service';

const ana = { id: 'user-1', name: 'Ana', email: 'ana@example.com' };

const TOKEN = `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'A'.repeat(43)}`;

afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
});

async function callbackFrom(pathname: string) {
    window.history.replaceState(null, '', `${window.location.origin}${pathname}`);
    const fetchMock = stubApi(() => Response.json({ url: 'https://accounts.google.com/o/oauth2/auth' }));
    await createAuthService().startSignIn();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    return JSON.parse(String(init?.body)).callbackURL;
}

describe('auth service', () => {
    describe('getSession', () => {
        it('gives the user of the session, and nothing else of it', async () => {
            const fetchMock = stubApi(() =>
                Response.json({ session: { token: 'secret' }, user: { ...ana, image: null, emailVerified: true } })
            );

            const user = await createAuthService().getSession();

            expect(user).toEqual(ana);
            expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/get-session');
        });

        it('is null when nobody is signed in', async () => {
            stubApi(() => Response.json(null));

            expect(await createAuthService().getSession()).toBeNull();
        });

        it('fails on a server error instead of reporting a sign-out', async () => {
            stubApi(() => new Response(null, { status: 503 }));

            await expect(createAuthService().getSession()).rejects.toMatchObject({ status: 503 });
            await expect(createAuthService().getSession()).rejects.toBeInstanceOf(ApiError);
        });

        it('fails on an answer that is not a session', async () => {
            stubApi(() => new Response('<!doctype html>', { status: 200 }));

            await expect(createAuthService().getSession()).rejects.toThrow();
        });

        it('fails on a user without an id', async () => {
            stubApi(() => Response.json({ user: { name: 'Ana', email: 'ana@example.com' } }));

            await expect(createAuthService().getSession()).rejects.toThrow();
        });

        it('fails on a user with an empty id, which would share its local data with the next one', async () => {
            stubApi(() => Response.json({ user: { ...ana, id: '' } }));

            await expect(createAuthService().getSession()).rejects.toThrow();
        });

        it('fails when the request never gets an answer', async () => {
            stubApi(() => {
                throw new TypeError('Failed to fetch');
            });

            await expect(createAuthService().getSession()).rejects.toThrow('Failed to fetch');
        });
    });

    describe('startSignIn', () => {
        it('asks for the Google URL and comes back to the app after it', async () => {
            const fetchMock = stubApi(() => Response.json({ url: 'https://accounts.google.com/o/oauth2/auth?x=1' }));

            const url = await createAuthService().startSignIn();

            expect(url).toBe('https://accounts.google.com/o/oauth2/auth?x=1');
            const [path, init] = fetchMock.mock.calls[0] ?? [];
            expect(path).toBe('/api/auth/sign-in/social');
            expect(init?.method).toBe('POST');
            expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
            expect(JSON.parse(String(init?.body))).toEqual({
                provider: 'google',
                callbackURL: '/',
                errorCallbackURL: '/?signin=failed',
            });
        });

        it('comes back to the link of an invitation it was started from', async () => {
            expect(await callbackFrom(`/join/${TOKEN}`)).toBe(`/join/${TOKEN}`);
        });

        it.each([
            ['another page', '/settings'],
            ['the join page with nothing after it', '/join/'],
            ['a token of the wrong shape', '/join/nonsense'],
            ['a signature that is too short', `/join/${TOKEN.slice(0, -1)}`],
            ['a path after the token', `/join/${TOKEN}/more`],
            ['an address on another origin', '//evil.example'],
            ['an address on another origin after the prefix', `/join//evil.example/${TOKEN}`],
            ['an encoded dot in the token', `/join/${TOKEN.replace('.', '%2E')}`],
            ['an encoded slash in front of the token', `/join/%2Fevil.example%2F${TOKEN}`],
            ['the token under another prefix', `/groups/join/${TOKEN}`],
        ])('comes back home from %s', async (_, pathname) => {
            expect(await callbackFrom(pathname)).toBe('/');
        });

        it('fails when the server refuses', async () => {
            stubApi(() => new Response(null, { status: 500 }));

            await expect(createAuthService().startSignIn()).rejects.toMatchObject({ status: 500 });
        });

        it('fails on an answer without a URL', async () => {
            stubApi(() => Response.json({}));

            await expect(createAuthService().startSignIn()).rejects.toThrow();
        });
    });

    describe('signOut', () => {
        it('posts to the sign-out route', async () => {
            const fetchMock = stubApi(() => Response.json({ success: true }));

            await createAuthService().signOut();

            const [path, init] = fetchMock.mock.calls[0] ?? [];
            expect(path).toBe('/api/auth/sign-out');
            expect(init?.method).toBe('POST');
            expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
        });

        it('fails when the server refuses', async () => {
            stubApi(() => new Response(null, { status: 403 }));

            await expect(createAuthService().signOut()).rejects.toMatchObject({ status: 403 });
        });

        it('fails when the request never gets an answer', async () => {
            stubApi(() => {
                throw new TypeError('Failed to fetch');
            });

            await expect(createAuthService().signOut()).rejects.toThrow('Failed to fetch');
        });
    });
});
