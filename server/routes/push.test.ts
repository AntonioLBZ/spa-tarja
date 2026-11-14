import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_PUSH_SUBSCRIPTIONS } from '@core/push';
import { app } from '@server/app';
import { send } from '@server/test/groups';
import { testVapidKey } from '@server/test/push';
import { signIn, type TestSession } from '@server/test/session';

let ana: TestSession;
let bruno: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
});

const P256DH = 'B'.repeat(87);
const AUTH = 'A'.repeat(22);

function subscription(endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`, locale = 'en') {
    return { endpoint, keys: { p256dh: P256DH, auth: AUTH }, locale };
}

async function stored(userId: string) {
    const { results } = await env.DB.prepare(
        'SELECT endpoint, locale FROM push_subscriptions WHERE user_id = ?1 ORDER BY updated_at, rowid'
    )
        .bind(userId)
        .all<{ endpoint: string; locale: string }>();
    return results;
}

describe('GET /api/push/key', () => {
    it('answers the public key of the server, in the form a browser subscribes with', async () => {
        const { jwk, publicKey } = await testVapidKey();
        const response = await app.request(
            '/api/push/key',
            { headers: ana.headers },
            { ...env, VAPID_PRIVATE_KEY: jwk }
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ key: publicKey });
    });

    it('answers 503 when the server has no key', async () => {
        const response = await app.request(
            '/api/push/key',
            { headers: ana.headers },
            { ...env, VAPID_PRIVATE_KEY: '' }
        );

        expect(response.status).toBe(503);
    });

    it('needs a session', async () => {
        expect((await app.request('/api/push/key', {}, env)).status).toBe(401);
    });
});

describe('PUT /api/push', () => {
    it('keeps the subscription of the device under the caller', async () => {
        const sent = subscription();

        expect((await send(ana, 'PUT', '/push', sent)).status).toBe(204);

        expect(await stored(ana.userId)).toEqual([{ endpoint: sent.endpoint, locale: 'en' }]);
    });

    it('takes the language again when the same device sends it again, and keeps one row', async () => {
        const sent = subscription();
        await send(ana, 'PUT', '/push', sent);

        await send(ana, 'PUT', '/push', { ...sent, locale: 'es' });

        expect(await stored(ana.userId)).toEqual([{ endpoint: sent.endpoint, locale: 'es' }]);
    });

    it('moves an address held by another person to the caller, who uses that browser now', async () => {
        const sent = subscription();
        await send(bruno, 'PUT', '/push', sent);

        await send(ana, 'PUT', '/push', sent);

        expect(await stored(bruno.userId)).toEqual([]);
        expect(await stored(ana.userId)).toHaveLength(1);
    });

    it('leaves an address with its person when the caller sends other keys for it', async () => {
        const sent = subscription();
        await send(bruno, 'PUT', '/push', sent);

        const taken = { ...sent, keys: { p256dh: 'C'.repeat(87), auth: 'D'.repeat(22) } };
        expect((await send(ana, 'PUT', '/push', taken)).status).toBe(204);

        expect(await stored(bruno.userId)).toHaveLength(1);
        expect(await stored(ana.userId)).toEqual([]);
    });

    it('takes new keys for an address the caller holds already', async () => {
        const sent = subscription();
        await send(ana, 'PUT', '/push', sent);

        await send(ana, 'PUT', '/push', { ...sent, keys: { p256dh: 'C'.repeat(87), auth: 'D'.repeat(22) } });

        const { results } = await env.DB.prepare('SELECT auth FROM push_subscriptions WHERE endpoint = ?1')
            .bind(sent.endpoint)
            .all<{ auth: string }>();
        expect(results).toEqual([{ auth: 'D'.repeat(22) }]);
    });

    it(`keeps at most ${MAX_PUSH_SUBSCRIPTIONS}, dropping the one sent longest ago`, async () => {
        const sent = Array.from({ length: MAX_PUSH_SUBSCRIPTIONS + 1 }, () => subscription());
        for (const one of sent) await send(ana, 'PUT', '/push', one);

        const kept = (await stored(ana.userId)).map((row) => row.endpoint);

        expect(kept).toHaveLength(MAX_PUSH_SUBSCRIPTIONS);
        expect(kept).not.toContain(sent[0]!.endpoint);
    });

    it.each([
        'https://fcm.googleapis.com.evil.test/x',
        'https://evil.test/fcm.googleapis.com',
        'https://fcm.googleapis.com@evil.test/x',
        'https://user:pass@fcm.googleapis.com/x',
        'http://fcm.googleapis.com/x',
        'https://push.apple.com.evil.test/x',
        'https://evilpush.apple.com/x',
        'https://jmt17.google.com.evil.test/x',
        'https://evil.google.com/x',
        'https://jmt.google.com/x',
        'not a url',
    ])('refuses an address that is not of a push service: %s', async (endpoint) => {
        expect((await send(ana, 'PUT', '/push', subscription(endpoint))).status).toBe(400);
        expect(await stored(ana.userId)).toEqual([]);
    });

    it.each([
        'https://fcm.googleapis.com/fcm/send/abc',
        'https://jmt17.google.com/fcm/send/abc',
        'https://updates.push.services.mozilla.com/wpush/v2/abc',
        'https://web.push.apple.com/abc',
        'https://wns2-db5p.notify.windows.com/w/?token=abc',
    ])('takes the address of a push service: %s', async (endpoint) => {
        expect((await send(ana, 'PUT', '/push', subscription(endpoint))).status).toBe(204);
    });

    it('refuses a language the app does not have and keys of the wrong shape', async () => {
        expect((await send(ana, 'PUT', '/push', subscription(undefined, 'fr'))).status).toBe(400);
        const bad = { ...subscription(), keys: { p256dh: 'short', auth: AUTH } };
        expect((await send(ana, 'PUT', '/push', bad)).status).toBe(400);
    });

    it('refuses a write from another origin', async () => {
        const headers = new Headers(ana.headers);
        headers.set('content-type', 'application/json');
        headers.set('origin', 'https://evil.test');
        const init = { method: 'PUT', headers, body: JSON.stringify(subscription()) };

        expect((await app.request('/api/push', init, env)).status).toBe(403);
    });

    it('needs a session', async () => {
        const init = {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(subscription()),
        };

        expect((await app.request('/api/push', init, env)).status).toBe(401);
    });
});

describe('DELETE /api/push', () => {
    it("deletes the caller's subscription, and answers the same for one they don't hold", async () => {
        const mine = subscription();
        const theirs = subscription();
        await send(ana, 'PUT', '/push', mine);
        await send(bruno, 'PUT', '/push', theirs);

        expect((await send(ana, 'DELETE', '/push', { endpoint: mine.endpoint })).status).toBe(204);
        expect((await send(ana, 'DELETE', '/push', { endpoint: theirs.endpoint })).status).toBe(204);

        expect(await stored(ana.userId)).toEqual([]);
        expect(await stored(bruno.userId)).toHaveLength(1);
    });
});

describe('deleting the account', () => {
    it('deletes the subscriptions of the person', async () => {
        await send(ana, 'PUT', '/push', subscription());

        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(ana.userId).run();

        expect(await stored(ana.userId)).toEqual([]);
    });
});
