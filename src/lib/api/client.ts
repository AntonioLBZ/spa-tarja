import { hc } from 'hono/client';

import { USER_HEADER } from '@core/account';

import type { AppType } from '@server/app';

// What answers without a session, or says who has one: no user to name
const UNNAMED = /^\/api\/(auth|health)(\/|$)/;

let boundUser: string | null = null;

// The user a window was opened for, until the returned function is called. The browser's cookie can change under an open
// window, so each call says whom it is for and the Worker refuses it when the session is another's.
const bindApiUser = (userId: string): (() => void) => {
    boundUser = userId;
    return () => {
        if (boundUser === userId) boundUser = null;
    };
};

const fetchAsUser: typeof fetch = (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input), window.location.href).pathname;
    if (boundUser === null || UNNAMED.test(path)) return fetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(USER_HEADER, boundUser);
    return fetch(input, { ...init, headers });
};

const api = hc<AppType>('/', { fetch: fetchAsUser });

export { api, bindApiUser, fetchAsUser };
