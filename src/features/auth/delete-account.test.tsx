import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { readSharedWith, rememberSharedWith } from '@/features/groups/shared-with';
import { readCachedUser } from '@/lib/auth';
import { PERSIST_BUSTER, createUserStorage, type KeyValueStorage, type PendingEntry } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Expense } from '@core/expense';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.settings.account.delete;

const expense: Expense = {
    id: crypto.randomUUID(),
    categoryId: 'food',
    text: 'Not sent yet',
    amountCents: 500,
    currency: 'EUR',
    date: '2026-10-25',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
};

const entry: PendingEntry = {
    id: crypto.randomUUID(),
    groupId: crypto.randomUUID(),
    kind: 'settlement',
    text: '',
    categoryId: null,
    amountCents: 500,
    currency: 'EUR',
    date: '2026-10-25',
    paidBy: crypto.randomUUID(),
    split: 'exact',
    shares: [{ memberId: crypto.randomUUID(), cents: 500 }],
    payment: 'direct',
    chargeDate: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
};

const KEYS = ['tarja:outbox', 'tarja:group-outbox', 'tarja:query-cache'];

// The user's copy on the device: an expense and an entry waiting in the outboxes, and the cache
async function seedCopy(storage: KeyValueStorage, userId: string) {
    const { storage: mine } = createUserStorage(storage, userId);
    await mine.set('tarja:outbox', [expense]);
    await mine.set('tarja:group-outbox', [entry]);
    await mine.set('tarja:query-cache', {
        timestamp: Date.now(),
        buster: PERSIST_BUSTER,
        clientState: { mutations: [], queries: [] },
    });
}

function openButton() {
    return screen.findByRole('button', { name: text.open }) as Promise<HTMLButtonElement>;
}

async function openDialog(storage: KeyValueStorage = createMemoryStorage()) {
    const api = createFakeApi();
    stubApi(api.handler);
    const app = renderApp({ path: '/settings', storage });
    fireEvent.click(await openButton());
    const dialog = await screen.findByRole('dialog', { name: text.title });
    return { api, app, dialog };
}

function emailField(dialog: HTMLElement) {
    return within(dialog).getByLabelText(text.label) as HTMLInputElement;
}

function deleteButton(dialog: HTMLElement) {
    return within(dialog).getByRole('button', { name: text.confirm }) as HTMLButtonElement;
}

function confirm(dialog: HTMLElement, email = TEST_USER.email) {
    fireEvent.change(emailField(dialog), { target: { value: email } });
    fireEvent.click(deleteButton(dialog));
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('delete account', () => {
    it('is a button under Sign out', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const button = await openButton();

        const signOut = screen.getByRole('button', { name: en.settings.account.signOut });
        expect(signOut.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('says what goes, what stays for the others and that the backups expire, and starts on the dialog', async () => {
        const { dialog } = await openDialog();

        expect(within(dialog).getByText(text.goes)).toBeDefined();
        expect(within(dialog).getByText(text.stays)).toBeDefined();
        expect(within(dialog).getByText(text.backups)).toBeDefined();
        expect(document.activeElement).toBe(dialog);
        const hint = t('settings.account.delete.hint', { email: TEST_USER.email });
        expect(emailField(dialog).getAttribute('aria-describedby')).toBe(within(dialog).getByText(hint).id);
    });

    it('keeps Delete off until the email of the account is typed, in any case', async () => {
        const { dialog } = await openDialog();

        expect(deleteButton(dialog).disabled).toBe(true);
        fireEvent.change(emailField(dialog), { target: { value: 'someone@example.com' } });
        expect(deleteButton(dialog).disabled).toBe(true);
        fireEvent.change(emailField(dialog), { target: { value: ` ${TEST_USER.email.toUpperCase()} ` } });
        expect(deleteButton(dialog).disabled).toBe(false);
    });

    it('closes on Cancel, sends nothing and forgets what was typed', async () => {
        const { api, dialog } = await openDialog();
        fireEvent.change(emailField(dialog), { target: { value: TEST_USER.email } });

        fireEvent.click(within(dialog).getByRole('button', { name: text.cancel }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(api.accountDeletions).toEqual([]);
        fireEvent.click(await openButton());
        expect(emailField(await screen.findByRole('dialog', { name: text.title })).value).toBe('');
    });

    it('leads to Your data to download it first', async () => {
        const { dialog } = await openDialog();

        fireEvent.click(within(dialog).getByRole('button', { name: text.export }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.settings.data.title }));
    });

    it('is off offline, says it needs a connection and sends nothing', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp({ path: '/settings' });
        const button = await openButton();

        onlineManager.setOnline(false);

        await waitFor(() => expect(button.disabled).toBe(true));
        expect(screen.getAllByRole('status').map((notice) => notice.textContent)).toContain(text.offline);
        expect(api.accountDeletions).toEqual([]);
    });

    it('turns Delete off when the connection drops while the dialog is open', async () => {
        const { dialog } = await openDialog();
        fireEvent.change(emailField(dialog), { target: { value: TEST_USER.email } });

        onlineManager.setOnline(false);

        await waitFor(() => expect(deleteButton(dialog).disabled).toBe(true));
        expect(within(dialog).getByText(text.offline)).toBeDefined();
    });

    it('says in words when the server could not delete it, and stays signed in', async () => {
        const storage = createMemoryStorage();
        await seedCopy(storage, TEST_USER.id);
        const { api, dialog } = await openDialog(storage);
        api.state.accountDeleteStatus = 503;

        confirm(dialog);

        expect((await within(dialog).findByRole('alert')).textContent).toBe(text.failed);
        expect(deleteButton(dialog).disabled).toBe(false);
        expect(readCachedUser()).toEqual(TEST_USER);
        for (const key of KEYS) expect(await storage.get(`${key}:${TEST_USER.id}`)).toBeDefined();
    });

    it('says when the connection dropped on the way', async () => {
        const { api, dialog } = await openDialog();
        api.state.offline = true;

        confirm(dialog);

        expect((await within(dialog).findByRole('alert')).textContent).toBe(text.failed);
    });

    it('says it is deleting while the server answers', async () => {
        const { api, dialog } = await openDialog();
        const release = api.hold();

        confirm(dialog);

        await waitFor(() => expect(within(dialog).getByRole('button', { name: text.deleting })).toBeDefined());
        expect((within(dialog).getByRole('button', { name: text.deleting }) as HTMLButtonElement).disabled).toBe(true);
        expect((within(dialog).getByRole('button', { name: text.cancel }) as HTMLButtonElement).disabled).toBe(true);
        release();
        expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
    });

    it('deletes the account, then both outboxes, the cache and the last group shared with, and signs out', async () => {
        const storage = createMemoryStorage();
        await seedCopy(storage, TEST_USER.id);
        await seedCopy(storage, 'someone-else');
        rememberSharedWith(crypto.randomUUID());
        const { api, app, dialog } = await openDialog(storage);

        confirm(dialog);

        expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
        expect(screen.getByRole('status').textContent).toBe(en.auth.deleted);
        expect(api.accountDeletions).toEqual([{ email: TEST_USER.email }]);
        for (const key of KEYS) {
            expect(await storage.get(`${key}:${TEST_USER.id}`)).toBeUndefined();
            expect(await storage.get(`${key}:someone-else`)).toBeDefined();
        }
        expect(readSharedWith()).toBeNull();
        expect(readCachedUser()).toBeNull();
        expect(app.fakeAuth.calls.signOut).toBe(0);
    });

    it('says so when the account went but the device could not delete its copy', async () => {
        const storage = createMemoryStorage();
        await seedCopy(storage, TEST_USER.id);
        const failing: KeyValueStorage = {
            ...storage,
            remove: async () => {
                throw new Error('The storage is blocked');
            },
        };
        const { dialog } = await openDialog(failing);

        confirm(dialog);

        expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
        expect(screen.getByRole('alert').textContent).toBe(en.auth.deletedNotCleared);
        expect(readCachedUser()).toBeNull();
    });
});
