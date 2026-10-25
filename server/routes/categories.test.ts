import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { signIn, type TestSession } from '@server/test/session';

interface CategoryBody {
    id: string;
    name: string;
    color: string;
    icon: string;
}

// What a category looks like when nobody chose a style
function plain(id: string, name: string): CategoryBody {
    return { id, name, color: 'gray', icon: 'category' };
}

let session: TestSession;

beforeEach(async () => {
    session = await signIn();
});

function put(id: string, body: unknown) {
    const headers = new Headers(session.headers);
    headers.set('content-type', 'application/json');
    return app.request(`/api/categories/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) }, env);
}

function remove(id: string) {
    return app.request(`/api/categories/${id}`, { method: 'DELETE', headers: session.headers }, env);
}

async function list() {
    const response = await app.request('/api/categories', { headers: session.headers }, env);
    expect(response.status).toBe(200);
    return ((await response.json()) as { categories: CategoryBody[] }).categories;
}

async function insertForeign(id: string, name: string) {
    await env.DB.prepare(
        `INSERT INTO categories (id, user_id, name, name_key, created_at) VALUES (?1, 'someone-else', ?2, lower(?2), 1)`
    )
        .bind(id, name)
        .run();
}

describe('GET /api/categories', () => {
    it('starts empty', async () => {
        expect(await list()).toEqual([]);
    });

    it('lists the caller’s categories, oldest first, and nobody else’s', async () => {
        const first = crypto.randomUUID();
        const second = crypto.randomUUID();
        await put(first, { name: 'Gym' });
        await put(second, { name: 'Pets' });
        await insertForeign(crypto.randomUUID(), 'Not yours');

        expect(await list()).toEqual([plain(first, 'Gym'), plain(second, 'Pets')]);
    });
});

describe('PUT /api/categories/:id', () => {
    it('creates the category and answers with it, the name trimmed', async () => {
        const id = crypto.randomUUID();

        const response = await put(id, { name: '  Gym ' });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(plain(id, 'Gym'));
    });

    it('is idempotent: repeating the same write changes nothing', async () => {
        const id = crypto.randomUUID();
        await put(id, { name: 'Gym' });

        const again = await put(id, { name: 'Gym' });

        expect(again.status).toBe(200);
        expect(await list()).toEqual([plain(id, 'Gym')]);
    });

    it('renames an existing category, also when only the case changes', async () => {
        const id = crypto.randomUUID();
        await put(id, { name: 'gym' });

        await put(id, { name: 'Gym' });
        expect(await list()).toEqual([plain(id, 'Gym')]);

        await put(id, { name: 'Fitness' });
        expect(await list()).toEqual([plain(id, 'Fitness')]);
    });

    it('stores the color and the icon it is given', async () => {
        const id = crypto.randomUUID();

        const response = await put(id, { name: 'Gym', color: 'blue', icon: 'fitness_center' });

        expect(await response.json()).toEqual({ id, name: 'Gym', color: 'blue', icon: 'fitness_center' });
        expect(await list()).toEqual([{ id, name: 'Gym', color: 'blue', icon: 'fitness_center' }]);
    });

    it('changes the color and the icon of an existing category', async () => {
        const id = crypto.randomUUID();
        await put(id, { name: 'Gym', color: 'blue', icon: 'fitness_center' });

        await put(id, { name: 'Gym', color: 'green', icon: 'spa' });

        expect(await list()).toEqual([{ id, name: 'Gym', color: 'green', icon: 'spa' }]);
    });

    it('keeps the style when a write only renames', async () => {
        const id = crypto.randomUUID();
        await put(id, { name: 'Gym', color: 'blue', icon: 'fitness_center' });

        await put(id, { name: 'Fitness' });

        expect(await list()).toEqual([{ id, name: 'Fitness', color: 'blue', icon: 'fitness_center' }]);
    });

    it('changes one of the two and keeps the other', async () => {
        const id = crypto.randomUUID();
        await put(id, { name: 'Gym', color: 'blue', icon: 'fitness_center' });

        await put(id, { name: 'Gym', color: 'green' });

        expect(await list()).toEqual([{ id, name: 'Gym', color: 'green', icon: 'fitness_center' }]);
    });

    it('gives a category created before styles existed the gray generic look', async () => {
        const id = crypto.randomUUID();
        await env.DB.prepare(
            `INSERT INTO categories (id, user_id, name, name_key, created_at) VALUES (?1, ?2, 'Old', 'old', 1)`
        )
            .bind(id, session.userId)
            .run();

        expect(await list()).toEqual([plain(id, 'Old')]);
    });

    it.each([
        ['an id that is not a UUID', 'food', { name: 'Gym' }],
        ['an empty name', crypto.randomUUID(), { name: '   ' }],
        ['a name that is too long', crypto.randomUUID(), { name: 'x'.repeat(41) }],
        ['no name', crypto.randomUUID(), {}],
        ['a color that is not in the list', crypto.randomUUID(), { name: 'Gym', color: 'red' }],
        ['an icon that is not in the list', crypto.randomUUID(), { name: 'Gym', icon: 'rocket' }],
    ])('rejects %s', async (_, id, body) => {
        const response = await put(id, body);

        expect(response.status).toBe(400);
        expect(await list()).toEqual([]);
    });

    it('answers 409 name-taken for a name another category has, ignoring case and accents', async () => {
        await put(crypto.randomUUID(), { name: 'Café' });

        const response = await put(crypto.randomUUID(), { name: ' CAFE ' });

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'name-taken' });
        expect(await list()).toHaveLength(1);
    });

    it('answers 409 name-taken when a rename lands on another category’s name', async () => {
        const gym = crypto.randomUUID();
        await put(gym, { name: 'Gym' });
        await put(crypto.randomUUID(), { name: 'Pets' });

        const response = await put(gym, { name: 'pets' });

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'name-taken' });
    });

    it('lets two users have a category with the same name', async () => {
        await insertForeign(crypto.randomUUID(), 'gym');

        const response = await put(crypto.randomUUID(), { name: 'Gym' });

        expect(response.status).toBe(200);
    });

    it('answers 409 id-taken for an id that belongs to someone else, and leaves it alone', async () => {
        const id = crypto.randomUUID();
        await insertForeign(id, 'Theirs');

        const response = await put(id, { name: 'Mine' });

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'id-taken' });
        const stored = await env.DB.prepare('SELECT name FROM categories WHERE id = ?1').bind(id).first();
        expect(stored).toEqual({ name: 'Theirs' });
    });
});

describe('DELETE /api/categories/:id', () => {
    it('removes the category and frees its name', async () => {
        const id = crypto.randomUUID();
        await put(id, { name: 'Gym' });

        const response = await remove(id);

        expect(response.status).toBe(204);
        expect(await list()).toEqual([]);
        expect((await put(crypto.randomUUID(), { name: 'Gym' })).status).toBe(200);
    });

    it('is idempotent: deleting what is already gone is fine', async () => {
        const response = await remove(crypto.randomUUID());

        expect(response.status).toBe(204);
    });

    it('never removes someone else’s category', async () => {
        const id = crypto.randomUUID();
        await insertForeign(id, 'Theirs');

        await remove(id);

        const stored = await env.DB.prepare('SELECT count(*) AS n FROM categories WHERE id = ?1').bind(id).first();
        expect(stored).toEqual({ n: 1 });
    });

    it('rejects an id that is not a UUID', async () => {
        expect((await remove('food')).status).toBe(400);
    });
});
