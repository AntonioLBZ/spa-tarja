import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { PROFILE_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { renderApp, stubApi } from '@/lib/test/render-app';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.nicknamePrompt;

function signInNow() {
    return renderApp({ fakeAuth: createFakeAuth({ cached: null }) });
}

async function openWithout() {
    const api = createFakeApi({ nickname: null });
    stubApi(api.handler);
    const app = signInNow();
    const sheet = await screen.findByRole('dialog', { name: text.title });
    return { api, app, sheet };
}

function field(sheet: HTMLElement) {
    return within(sheet).getByLabelText(text.label) as HTMLInputElement;
}

function button(sheet: HTMLElement, name: string) {
    return within(sheet).getByRole('button', { name }) as HTMLButtonElement;
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the nickname prompt', () => {
    it('asks for a nickname right after the sign-in when the person has none, with the field empty and the first name in the hint', async () => {
        const { sheet } = await openWithout();

        expect(field(sheet).value).toBe('');
        expect(document.activeElement).toBe(field(sheet));
        expect(within(sheet).getByText(t('nicknamePrompt.hint', { name: 'Ana' }))).toBeDefined();
    });

    it('saves the nickname, trimmed, and goes away', async () => {
        const { api, sheet } = await openWithout();

        fireEvent.change(field(sheet), { target: { value: '  Anita ' } });
        fireEvent.click(button(sheet, text.save));

        await waitFor(() => expect(screen.queryByRole('dialog', { name: text.title })).toBeNull());
        expect(api.profileBodies).toEqual([{ nickname: 'Anita' }]);
    });

    it.each([
        ['empty', ''],
        ['with nothing visible', '​ '],
    ])('refuses a nickname that is %s, without sending it', async (_, typed) => {
        const { api, sheet } = await openWithout();

        fireEvent.change(field(sheet), { target: { value: typed } });
        fireEvent.click(button(sheet, text.save));

        expect(await within(sheet).findByText(text.invalid)).toBeDefined();
        expect(field(sheet).getAttribute('aria-invalid')).toBe('true');
        expect(api.profileBodies).toEqual([]);
    });

    it('says so when the server could not save it, and stays open with what was typed', async () => {
        const { api, sheet } = await openWithout();
        api.state.profileWriteStatus = 500;

        fireEvent.change(field(sheet), { target: { value: 'Anita' } });
        fireEvent.click(button(sheet, text.save));

        expect(await within(sheet).findByRole('alert')).toHaveProperty('textContent', text.failed);
        expect(field(sheet).value).toBe('Anita');
    });

    it('goes away with Not now, sends nothing and does not come back while the app is open', async () => {
        const { api, app, sheet } = await openWithout();

        fireEvent.click(button(sheet, text.later));

        await waitFor(() => expect(screen.queryByRole('dialog', { name: text.title })).toBeNull());
        await app.queryClient.refetchQueries({ queryKey: PROFILE_KEY });
        fireEvent.click(screen.getAllByRole('link', { name: en.nav.groups })[0]!);
        await screen.findByRole('heading', { level: 1, name: en.nav.groups });
        expect(screen.queryByRole('dialog', { name: text.title })).toBeNull();
        expect(api.profileBodies).toEqual([]);
    });

    it('asks again at the next sign-in', async () => {
        const { app, sheet } = await openWithout();
        fireEvent.click(button(sheet, text.later));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: text.title })).toBeNull());
        app.unmount();

        signInNow();

        expect(await screen.findByRole('dialog', { name: text.title })).toBeDefined();
    });

    it('does not ask when the app opens with a session the device remembers', async () => {
        stubApi(createFakeApi({ nickname: null }).handler);
        const app = renderApp();

        await waitFor(() => expect(app.queryClient.getQueryState(PROFILE_KEY)?.status).toBe('success'));
        expect(screen.queryByRole('dialog', { name: text.title })).toBeNull();
    });

    it('does not ask a person who has a nickname', async () => {
        const api = createFakeApi({ nickname: 'Anita' });
        stubApi(api.handler);
        const app = signInNow();

        await waitFor(() => expect(app.queryClient.getQueryState(PROFILE_KEY)?.status).toBe('success'));
        expect(screen.queryByRole('dialog', { name: text.title })).toBeNull();
    });

    it('does not ask when the profile cannot be read', async () => {
        const api = createFakeApi({ nickname: null });
        api.state.offline = true;
        stubApi(api.handler);

        const app = signInNow();

        await waitFor(() => expect(app.queryClient.getQueryState(PROFILE_KEY)?.status).toBe('error'));
        expect(screen.queryByRole('dialog', { name: text.title })).toBeNull();
    });

    it('turns Save off with a notice when the connection goes', async () => {
        const { sheet } = await openWithout();

        onlineManager.setOnline(false);

        expect(await within(sheet).findByText(text.offline)).toBeDefined();
        expect(button(sheet, text.save).disabled).toBe(true);
        expect(button(sheet, text.later).disabled).toBe(false);
    });

    it('is in Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        stubApi(createFakeApi({ nickname: null }).handler);

        signInNow();

        const sheet = await screen.findByRole('dialog', { name: es.nicknamePrompt.title });
        expect(within(sheet).getByRole('button', { name: es.nicknamePrompt.later })).toBeDefined();
    });
});
