import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';
import { BUDGETS_KEY, CATEGORIES_KEY, EXPENSES_KEY, GROUPS_KEY, INCOME_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';

import type { Category } from '@core/categories/category';
import type { Expense } from '@core/expenses/expense';
import type { SharedGroup } from '@core/groups/shared-group';

const BOM = '﻿';

const GYM: Category = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' };

const ana = person('Ana', { role: 'owner' });

const bea = person('Bea');

const trip = (overrides: Partial<SharedGroup> = {}) => {
    return sampleGroup({ name: 'Trip', members: [ana, bea], me: ana.id, ...overrides });
};

const halves = (cents: number) => {
    return [
        { memberId: ana.id, cents },
        { memberId: bea.id, cents },
    ];
};

const expense = (overrides: Partial<Expense> = {}): Expense => {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
};

interface Download {
    name: string;
    type: string;
    text: string;
}

const readBlob = async (blob: Blob): Promise<string> => {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
};

const open = async (options: Parameters<typeof createFakeApi>[0] = {}) => {
    const api = createFakeApi(options);
    const fetchMock = stubApi(api.handler);
    const app = renderApp({ path: '/settings/account' });
    await screen.findByRole('heading', { name: en.settings.data.title });
    await waitFor(() => {
        expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(INCOME_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(BUDGETS_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success');
        for (const group of options.groups ?? []) {
            expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success');
        }
    });
    return { api, app, fetchMock };
};

export { ana, bea, BOM, type Download, expense, GYM, halves, open, readBlob, trip };
