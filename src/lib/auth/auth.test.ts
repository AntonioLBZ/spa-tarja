import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

import { createAuth } from './auth';
import { readCachedUser, writeCachedUser } from './session-cache';

import type { AuthService } from './service';
import type { AuthUser } from './user';

const ana: AuthUser = { id: 'user-1', name: 'Ana', email: 'ana@example.com' };

function createService(overrides: Partial<AuthService> = {}): AuthService {
    return {
        getSession: vi.fn(async () => ana),
        startSignIn: vi.fn(async () => 'https://accounts.google.com/auth'),
        signOut: vi.fn(async () => undefined),
        ...overrides,
    };
}

afterEach(() => localStorage.clear());

describe('auth', () => {
    describe('on start', () => {
        it('waits for the server when it has never seen a user', () => {
            const auth = createAuth(createService());

            expect(auth.getState()).toEqual({ status: 'loading' });
        });

        it('opens signed in as the user it remembers, with no request', () => {
            writeCachedUser(ana);
            const service = createService();

            const auth = createAuth(service);

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
            expect(service.getSession).not.toHaveBeenCalled();
        });
    });

    describe('check', () => {
        it('signs in the user of the session and remembers them', async () => {
            const auth = createAuth(createService());

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
            expect(readCachedUser()).toEqual(ana);
        });

        it('signs out, and forgets the user, when the server says there is no session', async () => {
            writeCachedUser(ana);
            const auth = createAuth(createService({ getSession: async () => null }));

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-out', unreachable: false });
            expect(readCachedUser()).toBeNull();
        });

        it('switches to the user the session belongs to when it is another one', async () => {
            writeCachedUser({ id: 'user-2', name: 'Bea', email: 'bea@example.com' });
            const auth = createAuth(createService());

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
            expect(readCachedUser()).toEqual(ana);
        });

        it('stays signed in when the server cannot be reached', async () => {
            writeCachedUser(ana);
            const auth = createAuth(
                createService({
                    getSession: async () => {
                        throw new TypeError('Failed to fetch');
                    },
                })
            );

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
            expect(readCachedUser()).toEqual(ana);
        });

        it('stays signed in on a server error', async () => {
            writeCachedUser(ana);
            const auth = createAuth(
                createService({
                    getSession: async () => {
                        throw new ApiError(503);
                    },
                })
            );

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
        });

        it('asks to sign in, saying the server is out of reach, when there is nobody to show', async () => {
            const auth = createAuth(
                createService({
                    getSession: async () => {
                        throw new TypeError('Failed to fetch');
                    },
                })
            );

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-out', unreachable: true });
        });

        it('signs in once the server is reachable again', async () => {
            const getSession = vi
                .fn<AuthService['getSession']>()
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce(ana);
            const auth = createAuth(createService({ getSession }));
            await auth.check();

            await auth.check();

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
        });

        it('asks the server once for overlapping checks', async () => {
            const service = createService();
            const auth = createAuth(service);

            await Promise.all([auth.check(), auth.check(), auth.check()]);

            expect(service.getSession).toHaveBeenCalledTimes(1);
        });

        it('asks again once the previous check is over', async () => {
            const service = createService();
            const auth = createAuth(service);

            await auth.check();
            await auth.check();

            expect(service.getSession).toHaveBeenCalledTimes(2);
        });

        it('keeps the same state object while nothing changes, as the store contract wants', async () => {
            const auth = createAuth(createService());
            await auth.check();
            const state = auth.getState();

            await auth.check();

            expect(auth.getState()).toBe(state);
        });
    });

    describe('subscribe', () => {
        it('tells listeners when the state changes, until they unsubscribe', async () => {
            const auth = createAuth(createService());
            const listener = vi.fn();
            const unsubscribe = auth.subscribe(listener);

            await auth.check();
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
            await auth.signOut();
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('signIn', () => {
        it('goes to the page the server named', async () => {
            const navigate = vi.fn();
            const auth = createAuth(createService(), navigate);

            await auth.signIn();

            expect(navigate).toHaveBeenCalledWith('https://accounts.google.com/auth');
        });

        it('fails, and stays where it is, when the server gives no page', async () => {
            const navigate = vi.fn();
            const auth = createAuth(
                createService({
                    startSignIn: async () => {
                        throw new TypeError('Failed to fetch');
                    },
                }),
                navigate
            );

            await expect(auth.signIn()).rejects.toThrow('Failed to fetch');
            expect(navigate).not.toHaveBeenCalled();
        });
    });

    describe('signOut', () => {
        it('ends the session and forgets the user', async () => {
            writeCachedUser(ana);
            const service = createService();
            const auth = createAuth(service);

            await auth.signOut();

            expect(service.signOut).toHaveBeenCalledTimes(1);
            expect(auth.getState()).toEqual({ status: 'signed-out', unreachable: false });
            expect(readCachedUser()).toBeNull();
        });

        it('keeps the user signed in when the server cannot end the session', async () => {
            writeCachedUser(ana);
            const auth = createAuth(
                createService({
                    signOut: async () => {
                        throw new TypeError('Failed to fetch');
                    },
                })
            );

            await expect(auth.signOut()).rejects.toThrow('Failed to fetch');

            expect(auth.getState()).toEqual({ status: 'signed-in', user: ana });
            expect(readCachedUser()).toEqual(ana);
        });
    });
});
