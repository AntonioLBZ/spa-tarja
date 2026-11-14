import * as v from 'valibot';

import { USER_HEADER, accountDeletionSchema, confirmsEmail } from '@core/account';
import { categoryNameKey, type Category } from '@core/category';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '@core/category-style';
import { profileInputSchema, type Profile } from '@core/profile';

import { TEST_USER } from './fake-auth';
import { createFakeGroups, type FakeGroupsOptions, type FakeGroupsState, type Refusal } from './fake-groups';

import type { Handler } from './render-app';
import type { Budget, BudgetLimitsInput } from '@core/budget';
import type { Expense } from '@core/expense';
import type { Income, IncomeInput } from '@core/income';

interface FakeApiOptions extends FakeGroupsOptions {
    expenses?: Expense[];
    categories?: Category[];
    income?: Income[];
    budgets?: Budget[];
    nickname?: string | null;
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

    // The account is that of the test user, who is the one signed in
    const profile: Profile = { nickname: options.nickname ?? null, name: TEST_USER.name };
    const profileBodies: unknown[] = [];

    const accountDeletions: unknown[] = [];

    const writes: Expense[] = [];
    const attempts: Expense[] = [];
    // What the device sent to keep or delete its push subscription
    const pushBodies: Array<{ method: string; body: unknown }> = [];
    const requests: string[] = [];
    // The user each request said it was made for, by request, null when it named nobody
    const requestUsers: Array<{ request: string; user: string | null }> = [];
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
        // An HTTP status to answer every profile write with, or null to accept them
        profileWriteStatus: null as number | null,
        // An HTTP status to answer every write of a push subscription with, or null to accept them
        pushWriteStatus: null as number | null,
        // Answers 401 to everything that needs a session, like the Worker does once it has ended
        unauthorized: false,
        // The user the browser's cookie carries, who a request that names another user is refused for. Null accepts any.
        cookieUser: null as string | null,
        // An HTTP status to answer the deletion of the account with, or null to delete it
        accountDeleteStatus: null as number | null,
        // The email the server holds for the account, which the deletion has to be confirmed with
        accountEmail: TEST_USER.email as string,
        // Answers every change of a group or of its people with it, or null to accept them
        groupRefusal: null as Refusal | null,
        // Answers every write of an entry of a group with it, or null to accept them
        entryRefusal: null as Refusal | null,
        // An entry of a group lands, and then the connection drops before its answer arrives
        loseEntryAnswers: false,
        // Answers reading, accepting or declining a link with these, instead of doing it
        linkRefusals: {} as FakeGroupsState['linkRefusals'],
    };

    const fakeGroups = createFakeGroups(options, state, profile);

    // While a test holds it, every request waits for the function it hands back to be called
    let gate: Promise<void> | null = null;
    const hold = () => {
        let release: () => void = () => undefined;
        gate = new Promise((resolve) => {
            release = resolve;
        });
        return () => {
            gate = null;
            release();
        };
    };

    const handler: Handler = async (url, init) => {
        const method = init?.method ?? 'GET';
        const request = `${method} ${url.pathname}${url.search}`;
        requests.push(request);
        requestUsers.push({ request, user: new Headers(init?.headers).get(USER_HEADER) });
        if (gate) await gate;

        if (state.offline) throw new TypeError('Failed to fetch');

        if (url.pathname === '/api/health') return Response.json({ ok: true });

        if (state.unauthorized) return Response.json({ error: 'unauthorized' }, { status: 401 });

        const named = new Headers(init?.headers).get(USER_HEADER);
        if (state.cookieUser !== null && named !== null && named !== state.cookieUser) {
            return Response.json({ error: 'other-user' }, { status: 401 });
        }

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

        if (url.pathname.startsWith('/api/groups') || url.pathname.startsWith('/api/invitations')) {
            return fakeGroups.handle(url, method, init);
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

        if (url.pathname === '/api/push/key' && method === 'GET') return Response.json({ key: 'B'.repeat(87) });

        if (url.pathname === '/api/push' && (method === 'PUT' || method === 'DELETE')) {
            pushBodies.push({ method, body: JSON.parse(String(init?.body)) });
            if (state.pushWriteStatus !== null) {
                return Response.json({ error: 'invalid' }, { status: state.pushWriteStatus });
            }
            return new Response(null, { status: 204 });
        }

        if (url.pathname === '/api/profile' && method === 'GET') return Response.json(profile);

        if (url.pathname === '/api/profile' && method === 'PUT') {
            const body: unknown = JSON.parse(String(init?.body));
            profileBodies.push(body);
            if (state.profileWriteStatus !== null) return new Response(null, { status: state.profileWriteStatus });

            const parsed = v.safeParse(profileInputSchema, body);
            if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
            profile.nickname = parsed.output.nickname;
            return Response.json(profile);
        }

        if (url.pathname === '/api/account' && method === 'DELETE') {
            const body: unknown = JSON.parse(String(init?.body));
            accountDeletions.push(body);
            if (state.accountDeleteStatus !== null) return new Response(null, { status: state.accountDeleteStatus });

            const parsed = v.safeParse(accountDeletionSchema, body);
            if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
            if (!confirmsEmail(parsed.output.email, state.accountEmail)) {
                return Response.json({ error: 'wrong-email' }, { status: 422 });
            }
            // The account and its sessions are gone
            state.unauthorized = true;
            return new Response(null, { status: 204 });
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
        requestUsers,
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
        profile,
        profileBodies,
        pushBodies,
        accountDeletions,
        hold,
        groups: fakeGroups.groups,
        groupRequests: fakeGroups.groupRequests,
        entryAttempts: fakeGroups.entryAttempts,
        entryWrites: fakeGroups.entryWrites,
        entriesOf: fakeGroups.entriesOf,
        cursorOf: fakeGroups.cursorOf,
        pendingInvitations: fakeGroups.pendingInvitations,
        serverWriteEntry: fakeGroups.serverWriteEntry,
        bringBack: fakeGroups.bringBack,
    };
};

export { createFakeApi };
