import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { EXPENSES_KEY, INCOME_KEY } from '@/lib/api';
import { PERSIST_BUSTER, createPersister, createUserStorage } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';

import type { Expense } from '@core/expense';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.summary;

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi(options);
    stubApi(api.handler);
    const app = renderApp({ path: '/summary' });
    await screen.findByRole('heading', { name: text.title });
    await waitFor(() => {
        expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(INCOME_KEY)?.status).toBe('success');
    });
    return { api, app };
}

function row(label: string) {
    return screen.getByText(label).closest('div')!;
}

function incomeField() {
    return screen.getByLabelText(/^Income of/) as HTMLInputElement;
}

function save(amount: string) {
    fireEvent.change(incomeField(), { target: { value: amount } });
    fireEvent.click(screen.getByRole('button', { name: text.form.save }));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('the month on screen', () => {
    it('is the current one to begin with', async () => {
        await open();

        expect(screen.getByText('October 2026')).toBeDefined();
    });

    it('moves to the next month and to the previous one', async () => {
        await open();

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));
        expect(screen.getByText('November 2026')).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.previous }));
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.previous }));
        expect(screen.getByText('September 2026')).toBeDefined();
    });

    it('goes across the turn of the year', async () => {
        await open();

        for (let step = 0; step < 3; step++) fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(screen.getByText('January 2027')).toBeDefined();
    });
});

describe('the links at the bottom', () => {
    it('lead to the budgets and to the charts', async () => {
        await open();

        expect(screen.getByRole('link', { name: text.budgetsLink }).getAttribute('href')).toBe('/budgets');
        expect(screen.getByRole('link', { name: text.chartsLink }).getAttribute('href')).toBe('/charts');
    });
});

describe('the numbers of a month', () => {
    it('add up what was spent in it, whichever category', async () => {
        await open({
            expenses: [
                expense({ amountCents: 1250 }),
                expense({ amountCents: 4599, categoryId: 'groceries' }),
                expense({ amountCents: 700, date: '2026-09-30' }),
            ],
        });

        expect(within(row(text.spent)).getByText('€58.49')).toBeDefined();
    });

    it('are zero for a month with nothing in it', async () => {
        await open();

        expect(within(row(text.spent)).getByText('€0.00')).toBeDefined();
    });

    it('follow the month on screen', async () => {
        await open({
            expenses: [expense({ amountCents: 1250 }), expense({ amountCents: 300, date: '2026-09-30' })],
        });

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.previous }));

        expect(within(row(text.spent)).getByText('€3.00')).toBeDefined();
    });

    it('count a deferred expense in the month it is charged', async () => {
        await open({
            expenses: [expense({ amountCents: 4000, date: '2026-09-28', payment: 'credit', chargeDate: '2026-11-05' })],
        });

        expect(within(row(text.spent)).getByText('€0.00')).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));
        expect(within(row(text.spent)).getByText('€40.00')).toBeDefined();
    });

    it('count each part of a plan in its own month', async () => {
        const plan = crypto.randomUUID();
        await open({
            expenses: ['2026-10-25', '2026-11-25'].map((chargeDate, index) =>
                expense({
                    amountCents: 500 + index,
                    payment: 'direct',
                    chargeDate,
                    plan: { id: plan, part: index + 1, parts: 2 },
                })
            ),
        });

        expect(within(row(text.spent)).getByText('€5.00')).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));
        expect(within(row(text.spent)).getByText('€5.01')).toBeDefined();
    });

    it('leave out deleted expenses', async () => {
        await open({ expenses: [expense({ amountCents: 1250 }), expense({ amountCents: 900, deletedAt: 5_000 })] });

        expect(within(row(text.spent)).getByText('€12.50')).toBeDefined();
    });

    it('include what is saved on the device and not yet synced', async () => {
        const { app } = await open({ expenses: [expense({ amountCents: 1250 })] });

        await app.outbox.put(expense({ amountCents: 300 }));

        expect(await within(row(text.spent)).findByText('€15.50')).toBeDefined();
    });

    it('show what a restaurant card paid as income of the month it is charged, and as spent in the month it was made', async () => {
        await open({
            expenses: [
                expense({ amountCents: 1800, date: '2026-09-20', payment: 'voucher', chargeDate: '2026-10-05' }),
                expense({ amountCents: 1000 }),
            ],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
        });

        expect(within(row(text.voucher)).getByText('€18.00')).toBeDefined();
        expect(within(row(text.spent)).getByText('€10.00')).toBeDefined();
        expect(within(row(text.left)).getByText('€2,008.00')).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.previous }));
        expect(within(row(text.spent)).getByText('€18.00')).toBeDefined();
        expect(screen.queryByText(text.voucher)).toBeNull();
    });

    it('do not list the restaurant card when nothing was paid with it', async () => {
        await open({ expenses: [expense()] });

        expect(screen.queryByText(text.voucher)).toBeNull();
    });

    it('show a shared dinner: your part spent and the rest paid back in October, your part as card income in November', async () => {
        await open({
            expenses: [
                expense({
                    amountCents: 4000,
                    personalCents: 2000,
                    date: '2026-10-12',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                }),
            ],
            income: [
                { month: '2026-10', amountCents: 200_000, currency: 'EUR' },
                { month: '2026-11', amountCents: 200_000, currency: 'EUR' },
            ],
        });

        expect(within(row(text.spent)).getByText('€20.00')).toBeDefined();
        expect(within(row(text.paidBack)).getByText('€20.00')).toBeDefined();
        expect(screen.queryByText(text.voucher)).toBeNull();
        expect(within(row(text.left)).getByText('€2,000.00')).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(within(row(text.voucher)).getByText('€20.00')).toBeDefined();
        expect(within(row(text.spent)).getByText('€0.00')).toBeDefined();
        expect(screen.queryByText(text.paidBack)).toBeNull();
        expect(within(row(text.left)).getByText('€2,020.00')).toBeDefined();
    });

    it('list what others paid back between the restaurant card and what was spent', async () => {
        await open({
            expenses: [
                expense({ amountCents: 4000, personalCents: 2000, payment: 'voucher', chargeDate: '2026-11-12' }),
                expense({ amountCents: 1800, date: '2026-09-20', payment: 'voucher', chargeDate: '2026-10-05' }),
            ],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
        });

        const labels = [...document.querySelectorAll('.summary__row dt')].map((label) => label.textContent);
        expect(labels).toEqual([text.income, text.voucher, text.paidBack, text.spent, text.left]);
    });

    it('count an older restaurant card expense in full, with nothing paid back', async () => {
        await open({
            expenses: [
                expense({ amountCents: 1800, date: '2026-10-03', payment: 'voucher', chargeDate: '2026-10-20' }),
            ],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
        });

        expect(within(row(text.voucher)).getByText('€18.00')).toBeDefined();
        expect(within(row(text.spent)).getByText('€18.00')).toBeDefined();
        expect(screen.queryByText(text.paidBack)).toBeNull();
        expect(within(row(text.left)).getByText('€2,000.00')).toBeDefined();
    });
});

describe('what is left', () => {
    it('is the income minus what was spent', async () => {
        await open({
            expenses: [expense({ amountCents: 25_000 })],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
        });

        expect(within(row(text.income)).getByText('€2,000.00')).toBeDefined();
        expect(within(row(text.left)).getByText('€1,750.00')).toBeDefined();
        expect(screen.queryByText(text.leftHint)).toBeNull();
    });

    it('is marked when it is below zero', async () => {
        await open({
            expenses: [expense({ amountCents: 25_000 })],
            income: [{ month: '2026-10', amountCents: 10_000, currency: 'EUR' }],
        });

        const value = within(row(text.left)).getByText('-€150.00');
        expect(value.className).toContain('summary__value--negative');
    });

    it('is not marked while there is something left', async () => {
        await open({ income: [{ month: '2026-10', amountCents: 10_000, currency: 'EUR' }] });

        expect(within(row(text.left)).getByText('€100.00').className).not.toContain('summary__value--negative');
    });

    it('is not marked when nothing is left', async () => {
        await open({
            expenses: [expense({ amountCents: 10_000 })],
            income: [{ month: '2026-10', amountCents: 10_000, currency: 'EUR' }],
        });

        expect(within(row(text.left)).getByText('€0.00').className).not.toContain('summary__value--negative');
    });

    it('waits for the income of that month, with a hint', async () => {
        await open({
            expenses: [expense()],
            income: [{ month: '2026-09', amountCents: 200_000, currency: 'EUR' }],
        });

        expect(screen.queryByText(text.left)).toBeNull();
        expect(screen.getByText(text.leftHint)).toBeDefined();
        expect(within(row(text.income)).getByText(text.notSet)).toBeDefined();
    });
});

describe('setting the income', () => {
    it('stores the month’s income, shows it and works out what is left', async () => {
        const { api } = await open({ expenses: [expense({ amountCents: 25_000 })] });

        save('2000');

        await waitFor(() => expect(api.incomeRequests).toEqual(['PUT 2026-10']));
        expect(api.income).toEqual([{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }]);
        expect(await within(row(text.income)).findByText('€2,000.00')).toBeDefined();
        expect(within(row(text.left)).getByText('€1,750.00')).toBeDefined();
        expect(screen.queryByText(text.leftHint)).toBeNull();
    });

    it('is for the month on screen', async () => {
        const { api } = await open();
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        save('1500,50');

        await waitFor(() => expect(api.incomeRequests).toEqual(['PUT 2026-11']));
        expect(api.income).toEqual([{ month: '2026-11', amountCents: 150_050, currency: 'EUR' }]);
    });

    it('starts the field with what the month already has, and changes it', async () => {
        const { api } = await open({ income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }] });
        expect(incomeField().value).toBe('2000.00');

        save('2100');

        await waitFor(() => expect(api.income).toEqual([{ month: '2026-10', amountCents: 210_000, currency: 'EUR' }]));
        expect(await within(row(text.income)).findByText('€2,100.00')).toBeDefined();
    });

    it('shows the field of each month with its own income', async () => {
        await open({ income: [{ month: '2026-11', amountCents: 150_000, currency: 'EUR' }] });
        expect(incomeField().value).toBe('');

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(incomeField().value).toBe('1500.00');
    });

    it('does not carry what was typed, or a complaint about it, over to another month', async () => {
        await open();
        save('abc');
        await screen.findByRole('alert');

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(incomeField().value).toBe('');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does not carry the complaint about a failed save over to another month', async () => {
        const { api } = await open();
        api.state.incomeWriteStatus = 503;
        save('2000');
        await screen.findByRole('alert');

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('keeps the income of the other months when one is set', async () => {
        const { api } = await open({ income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }] });
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        save('1500');
        await waitFor(() => expect(api.income).toHaveLength(2));
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.previous }));

        expect(within(row(text.income)).getByText('€2,000.00')).toBeDefined();
        expect(api.incomeRequests).toEqual(['PUT 2026-11']);
    });

    it('is named after the month it is for', async () => {
        await open();

        expect(screen.getByLabelText(t('summary.form.label', { month: 'October 2026' }))).toBeDefined();
    });

    it.each(['', 'abc', '0', '-5', '12.345'])('refuses %j and sends nothing', async (amount) => {
        const { api } = await open();

        save(amount);

        expect((await screen.findByRole('alert')).textContent).toBe(text.form.invalid);
        expect(incomeField().getAttribute('aria-invalid')).toBe('true');
        expect(api.incomeRequests).toEqual([]);
    });

    it('puts the message under the income field, which it describes', async () => {
        await open();

        save('abc');

        const alert = await screen.findByRole('alert');
        expect(alert.parentElement).toBe(incomeField().closest('.field'));
        expect(incomeField().getAttribute('aria-describedby')).toBe(alert.id);
    });

    it('stops complaining once the amount is typed again', async () => {
        await open();
        save('abc');
        await screen.findByRole('alert');

        fireEvent.change(incomeField(), { target: { value: '12' } });

        expect(screen.queryByRole('alert')).toBeNull();
        expect(incomeField().getAttribute('aria-invalid')).toBe('false');
    });

    it('cannot be sent twice while it is on its way', async () => {
        const api = createFakeApi();
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => (release = resolve));
        stubApi(async (url, init) => {
            if (init?.method === 'PUT') await held;
            return api.handler(url, init);
        });
        renderApp({ path: '/summary' });
        await screen.findByRole('heading', { name: text.title });
        const saveButton = () => screen.getByRole('button', { name: text.form.save }) as HTMLButtonElement;

        save('2000');
        await waitFor(() => expect(saveButton().disabled).toBe(true));
        release();

        await waitFor(() => expect(saveButton().disabled).toBe(false));
        expect(api.incomeRequests).toEqual(['PUT 2026-10']);
    });

    it('drops the complaint of a failed save once a later one works', async () => {
        const { api } = await open();
        api.state.incomeWriteStatus = 503;
        save('2000');
        await screen.findByRole('alert');
        api.state.incomeWriteStatus = null;

        fireEvent.click(screen.getByRole('button', { name: text.form.save }));

        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        expect(api.income).toHaveLength(1);
    });

    it('drops the complaint as soon as it tries again', async () => {
        const api = createFakeApi();
        let release: () => void = () => undefined;
        let held: Promise<void> | null = null;
        stubApi(async (url, init) => {
            if (init?.method === 'PUT' && held) await held;
            return api.handler(url, init);
        });
        renderApp({ path: '/summary' });
        await screen.findByRole('heading', { name: text.title });
        api.state.incomeWriteStatus = 503;
        save('2000');
        await screen.findByRole('alert');
        api.state.incomeWriteStatus = null;
        held = new Promise<void>((resolve) => (release = resolve));

        fireEvent.click(screen.getByRole('button', { name: text.form.save }));

        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        release();
    });

    it('says so when the server could not save it, and keeps what was typed', async () => {
        const { api } = await open();
        api.state.incomeWriteStatus = 503;

        save('2000');

        expect((await screen.findByRole('alert')).textContent).toBe(text.form.saveFailed);
        expect(incomeField().value).toBe('2000');
        expect(api.income).toEqual([]);
    });
});

describe('removing the income', () => {
    it('is offered only once there is one', async () => {
        await open();

        expect(screen.queryByRole('button', { name: text.form.remove })).toBeNull();
    });

    it('takes the income of the month away and hides what is left', async () => {
        const { api } = await open({
            expenses: [expense()],
            income: [
                { month: '2026-10', amountCents: 200_000, currency: 'EUR' },
                { month: '2026-09', amountCents: 100_000, currency: 'EUR' },
            ],
        });

        fireEvent.click(screen.getByRole('button', { name: text.form.remove }));

        await waitFor(() => expect(api.incomeRequests).toEqual(['DELETE 2026-10']));
        expect(api.income).toEqual([{ month: '2026-09', amountCents: 100_000, currency: 'EUR' }]);
        expect(await screen.findByText(text.leftHint)).toBeDefined();
        expect(incomeField().value).toBe('');
    });

    it('keeps the income of the other months', async () => {
        await open({
            income: [
                { month: '2026-10', amountCents: 200_000, currency: 'EUR' },
                { month: '2026-09', amountCents: 100_000, currency: 'EUR' },
            ],
        });

        fireEvent.click(screen.getByRole('button', { name: text.form.remove }));
        await screen.findByText(text.leftHint);
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.previous }));

        expect(within(row(text.income)).getByText('€1,000.00')).toBeDefined();
    });

    it('drops the complaint as soon as it tries again', async () => {
        const api = createFakeApi({ income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }] });
        let release: () => void = () => undefined;
        let held: Promise<void> | null = null;
        stubApi(async (url, init) => {
            if (init?.method === 'DELETE' && held) await held;
            return api.handler(url, init);
        });
        renderApp({ path: '/summary' });
        await screen.findByRole('heading', { name: text.title });
        await within(row(text.income)).findByText('€2,000.00');
        api.state.incomeWriteStatus = 503;
        fireEvent.click(screen.getByRole('button', { name: text.form.remove }));
        await screen.findByRole('alert');
        api.state.incomeWriteStatus = null;
        held = new Promise<void>((resolve) => (release = resolve));

        fireEvent.click(screen.getByRole('button', { name: text.form.remove }));

        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        release();
    });

    it('says so when the server could not do it, and keeps the income', async () => {
        const { api } = await open({ income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }] });
        api.state.incomeWriteStatus = 503;

        fireEvent.click(screen.getByRole('button', { name: text.form.remove }));

        expect((await screen.findByRole('alert')).textContent).toBe(text.form.removeFailed);
        expect(within(row(text.income)).getByText('€2,000.00')).toBeDefined();
    });
});

describe('in Spanish', () => {
    beforeEach(() => localStorage.setItem('tarja:locale', 'es'));
    afterEach(() => localStorage.clear());

    it('writes the month, the labels and the amounts the Spanish way', async () => {
        stubApi(createFakeApi({ income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }] }).handler);

        renderApp({ path: '/summary' });

        await screen.findByRole('heading', { name: es.summary.title });
        expect(screen.getByText('octubre de 2026')).toBeDefined();
        const incomeRow = screen.getByText(es.summary.income).closest('div')!;
        expect(
            await within(incomeRow).findByText(formatAmount(200_000, 'EUR', 'es').replace(/\s/g, ' '))
        ).toBeDefined();
        expect(screen.getByText(es.summary.spent)).toBeDefined();
    });
});

describe('getting to the summary', () => {
    it('is one link away from the home screen, and the brand leads back', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        fireEvent.click(await screen.findByRole('link', { name: en.nav.summary }));
        expect(await screen.findByRole('heading', { name: text.title })).toBeDefined();
        expect(screen.getByRole('link', { name: en.nav.summary }).getAttribute('aria-current')).toBe('page');

        fireEvent.click(screen.getByRole('link', { name: 'Tarja' }));
        expect(await screen.findByRole('button', { name: en.expenses.form.submit })).toBeDefined();
    });
});

describe('without a connection', () => {
    it('turns the income form off and says why', async () => {
        await open({ income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }] });

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        expect((screen.getByRole('button', { name: text.form.save }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: text.form.remove }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('says so when the income could not be loaded and there is no copy of it', async () => {
        const api = createFakeApi({ expenses: [expense()] });
        stubApi((url, init) =>
            url.pathname === '/api/income' ? new Response(null, { status: 500 }) : api.handler(url, init)
        );

        renderApp({ path: '/summary' });

        expect((await screen.findByRole('alert')).textContent).toBe(text.loadFailed);
    });

    it('does not complain about the income when there is a copy of it, even if the refresh failed', async () => {
        const storage = createMemoryStorage();
        const source = new QueryClient();
        source.setQueryData(EXPENSES_KEY, { expenses: [], cursor: 0 });
        source.setQueryData(INCOME_KEY, [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }]);
        const clientState = dehydrate(source);
        for (const query of clientState.queries) query.state.dataUpdatedAt = 0;
        await createPersister(createUserStorage(storage, TEST_USER.id).storage).persistClient({
            timestamp: Date.now(),
            buster: PERSIST_BUSTER,
            clientState,
        });
        const api = createFakeApi();
        const refused: string[] = [];
        stubApi((url, init) => {
            if (url.pathname !== '/api/income') return api.handler(url, init);
            refused.push(url.pathname);
            return new Response(null, { status: 500 });
        });

        renderApp({ path: '/summary', storage });

        await screen.findByRole('heading', { name: text.title });
        await waitFor(() => expect(refused).toHaveLength(1));
        expect(await within(row(text.income)).findByText('€2,000.00')).toBeDefined();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('still shows the numbers from the copy kept on the device', async () => {
        const storage = createMemoryStorage();
        const source = new QueryClient();
        source.setQueryData(EXPENSES_KEY, { expenses: [expense({ amountCents: 25_000 })], cursor: 1 });
        source.setQueryData(INCOME_KEY, [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }]);
        await createPersister(createUserStorage(storage, TEST_USER.id).storage).persistClient({
            timestamp: Date.now(),
            buster: PERSIST_BUSTER,
            clientState: dehydrate(source),
        });
        stubApi(createFakeApi().handler);
        onlineManager.setOnline(false);

        renderApp({ path: '/summary', storage });

        await screen.findByRole('heading', { name: text.title });
        expect(await within(row(text.left)).findByText('€1,750.00')).toBeDefined();
        expect(within(row(text.spent)).getByText('€250.00')).toBeDefined();
    });
});
