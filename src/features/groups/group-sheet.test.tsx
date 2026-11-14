import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { chosenOption, pickOption } from '@/lib/test/select';
import { openAddSheet } from '@/lib/test/sheet';

import type { SharedGroup } from '@core/shared-group';

const form = en.expenses.form;
const share = en.groups.share;

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');

const trip = (overrides: Partial<SharedGroup> = {}) => {
    return sampleGroup({ name: 'Trip', members: [ana, bea], me: ana.id, ...overrides });
};

const flat = () => sampleGroup({ name: 'Flat', members: [ana, bea], me: ana.id });

const open = async (path: string, groups: SharedGroup[]) => {
    stubApi(createFakeApi({ groups }).handler);
    const app = renderApp({ path });
    await screen.findAllByRole('button', { name: en.nav.add });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    return app;
};

const forChoice = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

const closeSheet = (dialog: HTMLElement) => {
    act(() => (dialog as HTMLDialogElement).close());
};

const goToGroup = async (name: string) => {
    fireEvent.click(screen.getByRole('link', { name: en.nav.groups }));
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(name) }));
    await screen.findByRole('heading', { name });
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('the plus inside a group', () => {
    it('starts a shared expense in the group of the screen, with For and With shown', async () => {
        const group = trip();
        await open(`/groups/${group.id}`, [group]);

        await openAddSheet();

        expect(forChoice(form.forShared).checked).toBe(true);
        expect(forChoice(form.forMe).checked).toBe(false);
        expect(chosenOption(share.with)).toBe('Trip');
    });

    it('does the same from the settings of the group', async () => {
        const group = trip();
        await open(`/groups/${group.id}/edit`, [group, flat()]);

        await openAddSheet();

        expect(forChoice(form.forShared).checked).toBe(true);
        expect(chosenOption(share.with)).toBe('Trip');
    });

    it('lets the person switch to another group or to Just me', async () => {
        const group = trip();
        await open(`/groups/${group.id}`, [group, flat()]);
        await openAddSheet();

        pickOption(share.with, 'Flat');
        expect(chosenOption(share.with)).toBe('Flat');

        fireEvent.click(forChoice(form.forMe));
        expect(screen.queryByRole('combobox', { name: share.with })).toBeNull();
    });

    it('starts as before in a closed group', async () => {
        const group = trip({ closed: 'deleted' });
        await open(`/groups/${group.id}`, [group, flat()]);

        await openAddSheet();

        expect(forChoice(form.forMe).checked).toBe(true);
    });

    it('starts as before on a screen that is not a group', async () => {
        await open('/settings', [trip()]);

        await openAddSheet();

        expect(forChoice(form.forMe).checked).toBe(true);
    });

    it('drops a draft typed elsewhere once closed, and starts in the group of the screen', async () => {
        const group = trip();
        await open('/', [group]);
        const dialog = await openAddSheet();
        fireEvent.change(within(dialog).getByLabelText(form.amount), { target: { value: '12' } });
        closeSheet(dialog);

        await goToGroup('Trip');
        const again = await openAddSheet();

        expect((within(again).getByLabelText(form.amount) as HTMLInputElement).value).toBe('');
        expect(forChoice(form.forShared).checked).toBe(true);
        expect(chosenOption(share.with)).toBe('Trip');
    });

    it('takes the group of the screen it is opened from while nothing is typed', async () => {
        const group = trip();
        await open(`/groups/${group.id}`, [group, flat()]);
        closeSheet(await openAddSheet());

        await goToGroup('Flat');
        await openAddSheet();

        expect(chosenOption(share.with)).toBe('Flat');
    });

    it('falls back to another open choice when the start group is closed meanwhile', async () => {
        const group = trip();
        const other = flat();
        const app = await open(`/groups/${group.id}`, [group, other]);
        await openAddSheet();

        act(() => app.queryClient.setQueryData(GROUPS_KEY, [{ ...group, closed: 'deleted' }, other]));

        await waitFor(() => expect(chosenOption(share.with)).toBe('Flat'));
    });
});
