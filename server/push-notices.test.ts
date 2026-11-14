import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '@server/app';
import { befriend, claim, makeGroup, memberNamed, send } from '@server/test/groups';
import { testBrowser, testVapidKey, type TestBrowser } from '@server/test/push';
import { signIn, type TestSession } from '@server/test/session';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;
let pushEnv: typeof env;
let pushed: Array<{ url: string; body: Uint8Array<ArrayBuffer> }>;
let answer: number;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
    pushEnv = { ...env, VAPID_PRIVATE_KEY: (await testVapidKey()).jwk, VAPID_SUBJECT: 'mailto:owner@example.com' };
    pushed = [];
    answer = 201;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
            pushed.push({ url, body: new Uint8Array(init.body as ArrayBuffer) });
            return new Response(null, { status: answer });
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

async function subscribe(as: TestSession, locale: 'en' | 'es' = 'en'): Promise<TestBrowser> {
    const browser = await testBrowser(locale);
    expect((await send(as, 'PUT', '/push', browser.subscription)).status).toBe(204);
    return browser;
}

async function putEntry(as: TestSession, groupId: string, id: string, body: unknown) {
    const headers = new Headers(as.headers);
    headers.set('content-type', 'application/json');
    const ctx = createExecutionContext();
    const init = { method: 'PUT', headers, body: JSON.stringify(body) };
    const response = await app.request(`/api/groups/${groupId}/entries/${id}`, init, pushEnv, ctx);
    await waitOnExecutionContext(ctx);
    return response;
}

function dinner(paidBy: string, shares: Record<string, number>, overrides: Record<string, unknown> = {}) {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-11-14',
        paidBy,
        split: 'exact',
        shares: list,
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

async function flatOfThree() {
    const group = await makeGroup(ana, ['Bruno', 'Carla'], 'Flat');
    const ids = { ana: group.me, bruno: memberNamed(group, 'Bruno'), carla: memberNamed(group, 'Carla') };
    await claim(ids.bruno, bruno);
    await claim(ids.carla, carla);
    return { group, ids };
}

describe('a push for a new shared entry', () => {
    it('reaches only the members it concerns, never its author', async () => {
        const { group, ids } = await flatOfThree();
        const brunoBrowser = await subscribe(bruno);
        await subscribe(carla);
        await subscribe(ana);

        const response = await putEntry(
            ana,
            group.id,
            crypto.randomUUID(),
            dinner(ids.ana, { [ids.ana]: 500, [ids.bruno]: 625 })
        );

        expect(response.status).toBe(200);
        expect(pushed.map((push) => push.url)).toEqual([brunoBrowser.subscription.endpoint]);
    });

    it('carries what the service worker words, in the language of the device', async () => {
        const { group, ids } = await flatOfThree();
        const browser = await subscribe(bruno, 'es');

        await putEntry(ana, group.id, crypto.randomUUID(), dinner(ids.ana, { [ids.bruno]: 625 }, { text: 'Pizza' }));

        expect(await browser.decrypt(pushed[0]!.body)).toEqual({
            locale: 'es',
            groupId: group.id,
            groupTitle: 'Flat',
            actor: 'Ana',
            notice: {
                kind: 'expense',
                groupId: group.id,
                entryId: expect.any(String),
                authorId: ids.ana,
                text: 'Pizza',
                currency: 'EUR',
                partCents: 625,
            },
        });
    });

    it('names a friend by the other person, as the one who gets it sees them', async () => {
        const friend = await befriend(ana, bruno);
        const browser = await subscribe(bruno);

        await putEntry(ana, friend.id, crypto.randomUUID(), dinner(friend.a, { [friend.b]: 300 }));

        expect(await browser.decrypt(pushed[0]!.body)).toMatchObject({ groupTitle: 'Ana', actor: 'Ana' });
    });

    it('sends nothing when the entry is sent again, edited or made deleted', async () => {
        const { group, ids } = await flatOfThree();
        await subscribe(bruno);
        const id = crypto.randomUUID();
        await putEntry(ana, group.id, id, dinner(ids.ana, { [ids.bruno]: 500 }));
        pushed = [];

        await putEntry(ana, group.id, id, dinner(ids.ana, { [ids.bruno]: 500 }));
        await putEntry(ana, group.id, id, dinner(ids.ana, { [ids.bruno]: 700 }, { updatedAt: 2_000 }));
        await putEntry(ana, group.id, crypto.randomUUID(), dinner(ids.ana, { [ids.bruno]: 500 }, { deletedAt: 1_000 }));

        expect(pushed).toEqual([]);
    });

    it('sends nothing to a member who left', async () => {
        const { group, ids } = await flatOfThree();
        await subscribe(carla);
        expect((await send(carla, 'DELETE', `/groups/${group.id}/members/${ids.carla}`)).status).toBe(200);

        await putEntry(ana, group.id, crypto.randomUUID(), dinner(ids.ana, { [ids.ana]: 500, [ids.bruno]: 500 }));

        expect(pushed).toEqual([]);
    });

    it('deletes a subscription its push service says is gone', async () => {
        const { group, ids } = await flatOfThree();
        await subscribe(bruno);
        answer = 410;

        await putEntry(ana, group.id, crypto.randomUUID(), dinner(ids.ana, { [ids.bruno]: 500 }));

        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?1')
            .bind(bruno.userId)
            .first<{ n: number }>();
        expect(row?.n).toBe(0);
    });

    it('sends nothing, and still saves the entry, when the server has no key', async () => {
        const { group, ids } = await flatOfThree();
        await subscribe(bruno);
        pushEnv = { ...pushEnv, VAPID_PRIVATE_KEY: '' };

        const response = await putEntry(ana, group.id, crypto.randomUUID(), dinner(ids.ana, { [ids.bruno]: 500 }));

        expect(response.status).toBe(200);
        expect(pushed).toEqual([]);
    });
});
