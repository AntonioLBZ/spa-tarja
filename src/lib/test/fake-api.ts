import { categoryNameKey, type Category } from '@core/category';

import type { Handler } from './render-app';
import type { Expense } from '@core/expense';

interface FakeApiOptions {
    expenses?: Expense[];
    categories?: Category[];
    // Most rows per page, whatever the client asks for
    pageSize?: number;
}

// An in-memory stand-in for the Worker's routes; anything it doesn't know answers 404
function createFakeApi(options: FakeApiOptions = {}) {
    const rows: Array<{ expense: Expense; seq: number }> = [];
    let lastSeq = 0;

    function store(expense: Expense) {
        const seq = ++lastSeq;
        const existing = rows.findIndex((row) => row.expense.id === expense.id);
        if (existing >= 0) rows[existing] = { expense, seq };
        else rows.push({ expense, seq });
    }

    for (const expense of options.expenses ?? []) store(expense);

    const categories = [...(options.categories ?? [])];
    const categoryRequests: string[] = [];

    const writes: Expense[] = [];
    const attempts: Expense[] = [];
    const requests: string[] = [];
    const state = {
        // An HTTP status to answer every write with, or null to accept them
        writeStatus: null as number | null,
        // Makes every request fail like a dropped connection
        offline: false,
        // An HTTP status to answer every category write with, or null to accept them
        categoryWriteStatus: null as number | null,
    };

    const handler: Handler = (url, init) => {
        const method = init?.method ?? 'GET';
        requests.push(`${method} ${url.pathname}${url.search}`);

        if (state.offline) throw new TypeError('Failed to fetch');

        if (url.pathname === '/api/health') return Response.json({ ok: true });

        if (url.pathname === '/api/expenses' && method === 'GET') {
            const after = Number(url.searchParams.get('after') ?? 0);
            const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), options.pageSize ?? 200);
            const changes = rows.filter((row) => row.seq > after).sort((a, b) => a.seq - b.seq);
            const page = changes.slice(0, limit);
            return Response.json({
                expenses: page.map((row) => row.expense),
                cursor: page.at(-1)?.seq ?? after,
                hasMore: changes.length > page.length,
            });
        }

        if (url.pathname === '/api/categories' && method === 'GET') return Response.json({ categories });

        const categoryId = /^\/api\/categories\/([^/]+)$/.exec(url.pathname)?.[1];
        if (categoryId && (method === 'PUT' || method === 'DELETE')) {
            categoryRequests.push(`${method} ${categoryId}`);
            if (state.categoryWriteStatus !== null) return new Response(null, { status: state.categoryWriteStatus });

            if (method === 'DELETE') {
                const at = categories.findIndex((category) => category.id === categoryId);
                if (at >= 0) categories.splice(at, 1);
                return new Response(null, { status: 204 });
            }

            const { name } = JSON.parse(String(init?.body)) as { name: string };
            const clash = categories.some(
                (category) => category.id !== categoryId && categoryNameKey(category.name) === categoryNameKey(name)
            );
            if (clash) return Response.json({ error: 'name-taken' }, { status: 409 });
            const at = categories.findIndex((category) => category.id === categoryId);
            if (at >= 0) categories[at] = { id: categoryId, name };
            else categories.push({ id: categoryId, name });
            return Response.json({ id: categoryId, name });
        }

        const id = /^\/api\/expenses\/([^/]+)$/.exec(url.pathname)?.[1];
        if (id && method === 'PUT') {
            const expense: Expense = { id, ...JSON.parse(String(init?.body)) };
            attempts.push(expense);
            if (state.writeStatus !== null) return new Response(null, { status: state.writeStatus });
            store(expense);
            writes.push(expense);
            return Response.json(expense);
        }

        return new Response(null, { status: 404 });
    };

    return {
        handler,
        writes,
        attempts,
        requests,
        state,
        // Something another device wrote
        serverWrite: store,
        categories,
        categoryRequests,
    };
}

export { createFakeApi };
