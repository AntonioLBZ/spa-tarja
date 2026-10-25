import type { Handler } from './render-app';
import type { Expense } from '@core/expense';

// An in-memory stand-in for the Worker's routes; anything it doesn't know answers 404
function createFakeApi(options: { expenses?: Expense[]; failWrites?: boolean } = {}) {
    const stored = new Map((options.expenses ?? []).map((expense) => [expense.id, expense]));
    const writes: Expense[] = [];
    const state = { failWrites: options.failWrites ?? false };

    const handler: Handler = (url, init) => {
        const method = init?.method ?? 'GET';

        if (url.pathname === '/api/health') return Response.json({ ok: true });

        if (url.pathname === '/api/expenses' && method === 'GET') {
            return Response.json({ expenses: [...stored.values()], cursor: stored.size, hasMore: false });
        }

        const id = /^\/api\/expenses\/([^/]+)$/.exec(url.pathname)?.[1];
        if (id && method === 'PUT') {
            if (state.failWrites) return new Response(null, { status: 500 });
            const expense: Expense = { id, ...JSON.parse(String(init?.body)) };
            stored.set(id, expense);
            writes.push(expense);
            return Response.json(expense);
        }

        return new Response(null, { status: 404 });
    };

    return { handler, writes, state };
}

export { createFakeApi };
