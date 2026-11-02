import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups;

async function edit(group: SharedGroup) {
    const api = createFakeApi({ groups: [group] });
    stubApi(api.handler);
    renderApp({ path: `/groups/${group.id}/edit` });
    await screen.findByRole('heading', { level: 1, name: t('groups.edit.title', { name: group.name ?? 'Bea' }) });
    return { api, saved: () => api.groups[0]! };
}

function showInExpenses() {
    return screen.getByRole('checkbox', { name: text.edit.show }) as HTMLInputElement;
}

function nameField() {
    return screen.queryByLabelText(text.edit.name) as HTMLInputElement | null;
}

function button(name: string) {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function rename(name: string) {
    fireEvent.change(nameField()!, { target: { value: name } });
    fireEvent.click(button(text.edit.save));
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the way to the settings', () => {
    it('is a link at the end of a group, Edit group', async () => {
        const group = sampleGroup({ name: 'Lisbon' });
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: `/groups/${group.id}` });

        const link = await screen.findByRole('link', { name: text.edit.link });
        expect(link.getAttribute('href')).toBe(`/groups/${group.id}/edit`);
        expect(link.className).toContain('button--ghost');

        fireEvent.click(link);

        expect(
            await screen.findByRole('heading', { level: 1, name: t('groups.edit.title', { name: 'Lisbon' }) })
        ).toBeDefined();
    });

    it('reads Edit friend for a friend, and is there for a closed group too', async () => {
        const friend = sampleGroup({ kind: 'direct', name: null, closed: 'deleted' });
        stubApi(createFakeApi({ groups: [friend] }).handler);
        renderApp({ path: `/groups/${friend.id}` });

        expect(await screen.findByRole('link', { name: text.edit.linkFriend })).toBeDefined();
    });

    it('says so, with a way back to Groups, for a group the device does not hold', async () => {
        stubApi(createFakeApi({ groups: [sampleGroup()] }).handler);
        renderApp({ path: `/groups/${crypto.randomUUID()}/edit` });

        expect(await screen.findByText(text.group.missing)).toBeDefined();
        expect(screen.getByRole('link', { name: text.group.back }).getAttribute('href')).toBe('/groups');
    });
});

describe('Show in my expenses', () => {
    it.each([
        ['an open group', sampleGroup({ name: 'Lisbon' })],
        ['a closed group', sampleGroup({ name: 'Lisbon', closed: 'left' })],
    ])('turns off and on again in %s, and the server keeps it', async (_, group) => {
        const { saved } = await edit(group);
        expect(showInExpenses().checked).toBe(true);
        expect(screen.getByText(text.edit.showHint).id).toBe(showInExpenses().getAttribute('aria-describedby'));

        fireEvent.click(showInExpenses());

        await waitFor(() => expect(showInExpenses().checked).toBe(false));
        expect(saved().showInExpenses).toBe(false);

        fireEvent.click(showInExpenses());

        await waitFor(() => expect(showInExpenses().checked).toBe(true));
        expect(saved().showInExpenses).toBe(true);
    });

    it('stays as it was when the server refuses, and says so', async () => {
        const { api, saved } = await edit(sampleGroup({ name: 'Lisbon' }));
        api.state.groupRefusal = { status: 503 };

        fireEvent.click(showInExpenses());

        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);
        expect(showInExpenses().checked).toBe(true);
        expect(saved().showInExpenses).toBe(true);
    });
});

describe('Archive', () => {
    it('puts a closed group among the archived and brings it back', async () => {
        const { saved } = await edit(sampleGroup({ name: 'Lisbon', closed: 'deleted' }));

        fireEvent.click(button(text.edit.archive));

        await screen.findByRole('button', { name: text.edit.unarchive });
        expect(saved().archived).toBe(true);

        fireEvent.click(button(text.edit.unarchive));

        await screen.findByRole('button', { name: text.edit.archive });
        expect(saved().archived).toBe(false);
    });

    it('is not offered for an open group', async () => {
        await edit(sampleGroup({ name: 'Lisbon' }));

        expect(screen.queryByRole('button', { name: text.edit.archive })).toBeNull();
        expect(screen.queryByRole('button', { name: text.edit.unarchive })).toBeNull();
    });
});

describe('the name', () => {
    it('is renamed by the owner, and the title follows', async () => {
        const { api, saved } = await edit(sampleGroup({ name: 'Lisbon' }));
        expect(nameField()!.value).toBe('Lisbon');

        rename(' Porto ');

        expect(
            await screen.findByRole('heading', { level: 1, name: t('groups.edit.title', { name: 'Porto' }) })
        ).toBeDefined();
        expect(saved().name).toBe('Porto');
        expect(api.groupRequests).toEqual([`PUT /api/groups/${saved().id}`]);
        expect(nameField()!.value).toBe('Porto');
    });

    it('refuses a name with nothing that shows, without sending it', async () => {
        const { api } = await edit(sampleGroup({ name: 'Lisbon' }));

        rename('​ ');

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameInvalid);
        expect(nameField()!.getAttribute('aria-invalid')).toBe('true');
        expect(api.groupRequests).toEqual([]);
    });

    it('says in words why the server refused it', async () => {
        const { api } = await edit(sampleGroup({ name: 'Lisbon' }));
        api.state.groupRefusal = { status: 403, error: 'not-owner' };

        rename('Porto');

        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.notOwner);
        expect(nameField()!.value).toBe('Porto');
    });

    it('says the group is closed when it closed meanwhile', async () => {
        const { api } = await edit(sampleGroup({ name: 'Lisbon' }));
        api.groups[0]!.closed = 'deleted';

        rename('Porto');

        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.readOnly);
    });

    it('is not there for a member who is not the owner', async () => {
        const ana = person('Ana', { role: 'owner' });
        const bea = person('Bea');
        await edit(sampleGroup({ name: 'Lisbon', members: [ana, bea], me: bea.id }));

        expect(nameField()).toBeNull();
        expect(showInExpenses()).toBeDefined();
    });

    it('is not there for a friend', async () => {
        await edit(sampleGroup({ kind: 'direct', name: null }));
        expect(nameField()).toBeNull();
    });

    it('is not there for a closed group, which keeps only its switches', async () => {
        await edit(sampleGroup({ name: 'Lisbon', closed: 'deleted' }));

        expect(nameField()).toBeNull();
        expect(showInExpenses()).toBeDefined();
        expect(button(text.edit.archive)).toBeDefined();
    });
});

describe('without a connection', () => {
    it('turns everything off and says why', async () => {
        await edit(sampleGroup({ name: 'Lisbon' }));

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        expect(showInExpenses().disabled).toBe(true);
        expect(nameField()!.disabled).toBe(true);
        expect(button(text.edit.save).disabled).toBe(true);
    });

    it('turns Archive off too', async () => {
        await edit(sampleGroup({ name: 'Lisbon', closed: 'deleted' }));

        onlineManager.setOnline(false);

        await screen.findByText(text.offline);
        expect(button(text.edit.archive).disabled).toBe(true);
    });
});
