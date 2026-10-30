import { categoryNameKey, type Category } from '@core/category';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '@core/category-style';

import type { Handler } from './render-app';
import type { Budget, BudgetLimitsInput } from '@core/budget';
import type { Expense } from '@core/expense';
import type { Income, IncomeInput } from '@core/income';

interface FakeApiOptions {
    expenses?: Expense[];
    categories?: Category[];
    income?: Income[];
    budgets?: Budget[];
    // Most rows per page, whatever the client asks for
    pageSize?: number;
}

// An in-memory stand-in for the Worker's routes; anything it doesn't know answers 404
const createFakeApi = (options: FakeApiOptions = {}) => {
    const rows: Array<{ expense: Expense; seq: number }> = [];
    let lastSeq = 0;

    const store = (expense: Expense) => {
        const seq = ++lastSeq;
        const existing = rows.findIndex((row) => row.expense.id === expense.id);
        if (existing >= 0) rows[existing] = { expense, seq };
        else rows.push({ expense, seq });
    };

    for (const expense of options.expenses ?? []) store(expense);

    const categories = [...(options.categories ?? [])];
    const categoryRequests: string[] = [];

    const income = [...(options.income ?? [])];
    const incomeRequests: string[] = [];

    const budgets = [...(options.budgets ?? [])];
    const budgetRequests: string[] = [];
    const budgetBodies: unknown[] = [];

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
        // An HTTP status to answer every income write with, or null to accept them
        incomeWriteStatus: null as number | null,
        // An HTTP status to answer every budget write with, or null to accept them
        budgetWriteStatus: null as number | null,
        // Answers 401 to everything that needs a session, like the Worker does once it has ended
        unauthorized: false,
    };

    const handler: Handler = (url, init) => {
        const method = init?.method ?? 'GET';
        requests.push(`${method} ${url.pathname}${url.search}`);

        if (state.offline) throw new TypeError('Failed to fetch');

        if (url.pathname === '/api/health') return Response.json({ ok: true });

        if (state.unauthorized) return Response.json({ error: 'unauthorized' }, { status: 401 });

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

            const { name, color, icon } = JSON.parse(String(init?.body)) as Partial<Category>;
            if (!name) return Response.json({ error: 'invalid' }, { status: 400 });
            const clash = categories.some(
                (category) => category.id !== categoryId && categoryNameKey(category.name) === categoryNameKey(name)
            );
            if (clash) return Response.json({ error: 'name-taken' }, { status: 409 });
            const at = categories.findIndex((category) => category.id === categoryId);
            // Like the Worker: what isn't sent stays as it was, or is the plain look on a new category
            const saved: Category = {
                id: categoryId,
                name,
                color: color ?? categories[at]?.color ?? DEFAULT_CATEGORY_COLOR,
                icon: icon ?? categories[at]?.icon ?? DEFAULT_CATEGORY_ICON,
            };
            if (at >= 0) categories[at] = saved;
            else categories.push(saved);
            return Response.json(saved);
        }

        if (url.pathname === '/api/income' && method === 'GET') return Response.json({ income });

        const month = /^\/api\/income\/([^/]+)$/.exec(url.pathname)?.[1];
        if (month && (method === 'PUT' || method === 'DELETE')) {
            incomeRequests.push(`${method} ${month}`);
            if (state.incomeWriteStatus !== null) return new Response(null, { status: state.incomeWriteStatus });

            const at = income.findIndex((item) => item.month === month);
            if (method === 'DELETE') {
                if (at >= 0) income.splice(at, 1);
                return new Response(null, { status: 204 });
            }

            const saved: Income = { month, ...(JSON.parse(String(init?.body)) as IncomeInput) };
            if (at >= 0) income[at] = saved;
            else income.push(saved);
            return Response.json(saved);
        }

        if (url.pathname === '/api/budgets' && method === 'GET') return Response.json({ budgets });

        const budgetMonth = /^\/api\/budgets\/([^/]+)$/.exec(url.pathname)?.[1];
        if (budgetMonth && method === 'PUT') {
            budgetRequests.push(`${method} ${budgetMonth}`);
            const body = JSON.parse(String(init?.body)) as BudgetLimitsInput;
            budgetBodies.push(body);
            if (state.budgetWriteStatus !== null) return new Response(null, { status: state.budgetWriteStatus });

            const saved = body.limits.map((limit): Budget => ({
                month: budgetMonth,
                scope: limit.scope,
                amountCents: limit.amountCents,
                currency: body.currency,
            }));
            for (const row of saved) {
                const at = budgets.findIndex((item) => item.month === row.month && item.scope === row.scope);
                if (at >= 0) budgets[at] = row;
                else budgets.push(row);
            }
            return Response.json({ budgets: saved });
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
        income,
        incomeRequests,
        budgets,
        budgetRequests,
        budgetBodies,
    };
};

export { createFakeApi };
