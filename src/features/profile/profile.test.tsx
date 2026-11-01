import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { PROFILE_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { NICKNAME_MAX_LENGTH } from '@core/profile';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.settings.profile;

async function open(nickname: string | null = null) {
    const api = createFakeApi({ nickname });
    stubApi(api.handler);
    const app = renderApp({ path: '/settings' });
    await screen.findByRole('heading', { name: text.title });
    await waitFor(() => expect(app.queryClient.getQueryState(PROFILE_KEY)?.status).toBe('success'));
    return { api, app };
}

function field() {
    return screen.getByLabelText(text.label) as HTMLInputElement;
}

function button(name: string) {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function save(nickname: string) {
    fireEvent.change(field(), { target: { value: nickname } });
    fireEvent.click(button(text.save));
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the profile section', () => {
    it('comes after the app color and before the categories', async () => {
        await open();

        const accent = screen.getByRole('group', { name: en.settings.accent.title });
        const profile = screen.getByRole('heading', { name: text.title });
        const categories = screen.getByRole('heading', { name: en.settings.categories.title });

        expect(accent.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(profile.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('says who sees the nickname and names the account that stands in for it', async () => {
        await open();

        const hint = t('settings.profile.hint', { name: TEST_USER.name });
        expect(screen.getByText(hint)).toBeDefined();
        expect(field().getAttribute('aria-describedby')).toBe(screen.getByText(hint).id);
    });

    it('holds a nickname of the longest length the server takes, and no longer', async () => {
        await open();

        expect(field().maxLength).toBe(NICKNAME_MAX_LENGTH);
    });

    it('starts empty, with nothing to remove, when there is no nickname', async () => {
        await open();

        expect(field().value).toBe('');
        expect(screen.queryByRole('button', { name: text.remove })).toBeNull();
    });

    it('starts with the nickname there is', async () => {
        await open('Anita');

        await waitFor(() => expect(field().value).toBe('Anita'));
        expect(button(text.remove)).toBeDefined();
    });
});

describe('saving the nickname', () => {
    it('sends it trimmed, keeps it and offers to remove it', async () => {
        const { api } = await open();

        save('  Anita ');

        await waitFor(() => expect(api.profile.nickname).toBe('Anita'));
        expect(api.profileBodies).toEqual([{ nickname: 'Anita' }]);
        expect(await screen.findByRole('button', { name: text.remove })).toBeDefined();
        expect(field().value).toBe('Anita');
    });

    it('replaces the one there was', async () => {
        const { api } = await open('Anita');
        await waitFor(() => expect(field().value).toBe('Anita'));

        save('La Ana');

        await waitFor(() => expect(api.profile.nickname).toBe('La Ana'));
        expect(field().value).toBe('La Ana');
    });

    it('removes it when the field is saved empty', async () => {
        const { api } = await open('Anita');
        await waitFor(() => expect(field().value).toBe('Anita'));

        save('   ');

        await waitFor(() => expect(api.profile.nickname).toBeNull());
        expect(api.profileBodies).toEqual([{ nickname: null }]);
        await waitFor(() => expect(screen.queryByRole('button', { name: text.remove })).toBeNull());
        expect(field().value).toBe('');
    });

    it('refuses a nickname with nothing visible in it, without sending it', async () => {
        const { api } = await open();

        save('​⁠');

        expect((await screen.findByRole('alert')).textContent).toBe(text.invalid);
        expect(field().getAttribute('aria-invalid')).toBe('true');
        expect(api.profileBodies).toEqual([]);
    });

    it('stops complaining about an invisible nickname once something is typed again', async () => {
        await open();
        save('​');
        await screen.findByRole('alert');

        fireEvent.change(field(), { target: { value: 'Ana' } });

        expect(screen.queryByRole('alert')).toBeNull();
        expect(field().getAttribute('aria-invalid')).toBe('false');
    });

    it('cannot be sent twice while it is on its way', async () => {
        const api = createFakeApi();
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => (release = resolve));
        stubApi(async (url, init) => {
            if (init?.method === 'PUT') await held;
            return api.handler(url, init);
        });
        renderApp({ path: '/settings' });
        await screen.findByRole('heading', { name: text.title });

        save('Anita');
        fireEvent.click(button(text.save));

        expect(button(text.save).disabled).toBe(true);
        release();
        await waitFor(() => expect(button(text.save).disabled).toBe(false));
        expect(api.profileBodies).toHaveLength(1);
    });

    it('keeps what is typed while the save is on its way', async () => {
        const api = createFakeApi();
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => (release = resolve));
        stubApi(async (url, init) => {
            if (init?.method === 'PUT') await held;
            return api.handler(url, init);
        });
        renderApp({ path: '/settings' });
        await screen.findByRole('heading', { name: text.title });
        save('Ana');

        fireEvent.change(field(), { target: { value: 'Ana B' } });
        release();

        await waitFor(() => expect(api.profile.nickname).toBe('Ana'));
        await waitFor(() => expect(button(text.save).disabled).toBe(false));
        expect(field().value).toBe('Ana B');
        expect(api.profileBodies).toEqual([{ nickname: 'Ana' }]);
    });

    it('says so when the server could not save it, and keeps what was typed', async () => {
        const { api } = await open();
        api.state.profileWriteStatus = 503;

        save('Anita');

        expect((await screen.findByRole('alert')).textContent).toBe(text.saveFailed);
        expect(field().value).toBe('Anita');
        expect(api.profile.nickname).toBeNull();
    });

    it('drops the complaint once a later save works', async () => {
        const { api } = await open();
        api.state.profileWriteStatus = 503;
        save('Anita');
        await screen.findByRole('alert');
        api.state.profileWriteStatus = null;

        fireEvent.click(button(text.save));

        await waitFor(() => expect(api.profile.nickname).toBe('Anita'));
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('removing the nickname', () => {
    it('takes it away and empties the field', async () => {
        const { api } = await open('Anita');
        await waitFor(() => expect(field().value).toBe('Anita'));

        fireEvent.click(button(text.remove));

        await waitFor(() => expect(api.profile.nickname).toBeNull());
        expect(api.profileBodies).toEqual([{ nickname: null }]);
        await waitFor(() => expect(field().value).toBe(''));
        expect(screen.queryByRole('button', { name: text.remove })).toBeNull();
    });

    it('says so when the server could not do it, and keeps the nickname', async () => {
        const { api } = await open('Anita');
        await waitFor(() => expect(field().value).toBe('Anita'));
        api.state.profileWriteStatus = 503;

        fireEvent.click(button(text.remove));

        expect((await screen.findByRole('alert')).textContent).toBe(text.removeFailed);
        expect(field().value).toBe('Anita');
        expect(api.profile.nickname).toBe('Anita');
    });
});

describe('without a connection', () => {
    it('turns the field and its buttons off, with the nickname still in it, and says why', async () => {
        await open('Anita');
        await waitFor(() => expect(field().value).toBe('Anita'));

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        expect(field().disabled).toBe(true);
        expect(field().value).toBe('Anita');
        expect(button(text.save).disabled).toBe(true);
        expect(button(text.remove).disabled).toBe(true);
    });

    it('is off from the start when the app opens offline', async () => {
        const api = createFakeApi({ nickname: 'Anita' });
        api.state.offline = true;
        stubApi(api.handler);
        onlineManager.setOnline(false);

        renderApp({ path: '/settings' });

        expect(await screen.findByText(text.offline)).toBeDefined();
        expect(field().disabled).toBe(true);
        expect(button(text.save).disabled).toBe(true);
        expect(screen.getByText(t('settings.profile.hint', { name: TEST_USER.name }))).toBeDefined();
    });

    it('turns them on again once back online', async () => {
        await open('Anita');
        onlineManager.setOnline(false);
        await screen.findByText(text.offline);

        onlineManager.setOnline(true);

        await waitFor(() => expect(field().disabled).toBe(false));
        expect(button(text.save).disabled).toBe(false);
        expect(screen.queryByText(text.offline)).toBeNull();
    });
});

describe('in Spanish', () => {
    it('names the section, the field and its buttons in Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        stubApi(createFakeApi({ nickname: 'Anita' }).handler);

        renderApp({ path: '/settings' });

        expect(await screen.findByRole('heading', { name: es.settings.profile.title })).toBeDefined();
        expect(screen.getByLabelText(es.settings.profile.label)).toBeDefined();
        expect(screen.getByRole('button', { name: es.settings.profile.save })).toBeDefined();
        expect(await screen.findByRole('button', { name: es.settings.profile.remove })).toBeDefined();
    });
});
