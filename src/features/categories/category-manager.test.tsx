import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

const text = en.categoryManager;

const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;

function plainCategory(name: string) {
    return { id: crypto.randomUUID(), name, color: 'gray', icon: 'category' } as const;
}

function named(template: string, name: string) {
    return template.replace('{name}', name);
}

function button(name: string) {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function newNameField() {
    return screen.getByLabelText(text.add.label) as HTMLInputElement;
}

function add(name: string) {
    fireEvent.change(newNameField(), { target: { value: name } });
    fireEvent.click(button(text.add.submit));
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi(options);
    stubApi(api.handler);
    renderApp({ path: '/categories' });
    await screen.findByRole('heading', { name: text.title });
    return api;
}

afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('reaching the screen', () => {
    it('is linked from the settings', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        fireEvent.click(await screen.findByRole('link', { name: en.settings.categories }));

        expect(await screen.findByRole('heading', { name: text.title })).toBeDefined();
    });
});

describe('listing', () => {
    it('shows the built-in categories, which have nothing to change', async () => {
        await open();

        for (const name of Object.values(en.categories)) expect(screen.getByText(name)).toBeDefined();
        expect(screen.queryByRole('button', { name: named(text.renameItem, en.categories.food) })).toBeNull();
        expect(screen.queryByRole('button', { name: named(text.deleteItem, en.categories.food) })).toBeNull();
    });

    it('says there are none of the person’s own yet', async () => {
        await open();

        expect(await screen.findByText(text.custom.empty)).toBeDefined();
    });

    it('lists the person’s own categories', async () => {
        await open({ categories: [gym, plainCategory('Pets')] });

        expect(await screen.findByText('Gym')).toBeDefined();
        expect(screen.getByText('Pets')).toBeDefined();
        expect(screen.queryByText(text.custom.empty)).toBeNull();
    });

    it('says so when the categories cannot be loaded', async () => {
        stubApi(() => new Response(null, { status: 500 }));
        renderApp({ path: '/categories' });

        expect(await screen.findByText(text.loadFailed)).toBeDefined();
        expect(screen.queryByText(text.custom.empty)).toBeNull();
    });
});

describe('adding', () => {
    it('creates the category, lists it and empties the field', async () => {
        const api = await open();
        await screen.findByText(text.custom.empty);

        add('  Pets ');

        expect(await screen.findByText('Pets')).toBeDefined();
        expect(api.categories).toEqual([
            { id: expect.any(String), name: 'Pets', color: 'vermillion', icon: 'category' },
        ]);
        expect(api.categoryRequests).toEqual([`PUT ${api.categories[0]?.id}`]);
        expect(newNameField().value).toBe('');
        expect(screen.queryByText(text.custom.empty)).toBeNull();
    });

    it('gives each new category the next color nobody uses, and the generic icon', async () => {
        const api = await open();
        await screen.findByText(text.custom.empty);

        add('Pets');
        await screen.findByText('Pets');
        add('Books');
        await screen.findByText('Books');

        expect(api.categories.map(({ name, color, icon }) => ({ name, color, icon }))).toEqual([
            { name: 'Pets', color: 'vermillion', icon: 'category' },
            { name: 'Books', color: 'green', icon: 'category' },
        ]);
    });

    it('sends nothing for a blank name', async () => {
        const api = await open();
        await screen.findByText(text.custom.empty);

        add('   ');

        expect(api.categoryRequests).toEqual([]);
    });

    it.each([
        ['another category of theirs, whatever the case', 'GYM'],
        ['a built-in one', en.categories.food.toUpperCase()],
    ])('refuses a name that is already taken by %s, without asking the server', async (_, name) => {
        const api = await open({ categories: [gym] });
        await screen.findByText('Gym');

        add(name);

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameTaken);
        expect(api.categoryRequests).toEqual([]);
        expect(newNameField().value).toBe(name);
    });

    it('shows the server’s refusal when another device took the name meanwhile', async () => {
        const api = await open();
        await screen.findByText(text.custom.empty);
        api.categories.push(gym);

        add('Gym');

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameTaken);
        expect(screen.queryByText('Gym')).toBeNull();
    });

    it('says so when saving fails, and keeps what was typed', async () => {
        const api = await open();
        await screen.findByText(text.custom.empty);
        api.state.categoryWriteStatus = 500;

        add('Pets');

        expect((await screen.findByRole('alert')).textContent).toBe(text.saveFailed);
        expect(newNameField().value).toBe('Pets');
        expect(screen.getByText(text.custom.empty)).toBeDefined();
    });

    it('clears the message once the person types again', async () => {
        await open({ categories: [gym] });
        await screen.findByText('Gym');
        add('gym');
        await screen.findByRole('alert');

        fireEvent.change(newNameField(), { target: { value: 'Gy' } });

        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('renaming', () => {
    async function startRename() {
        const api = await open({ categories: [gym] });
        await screen.findByText('Gym');
        fireEvent.click(button(named(text.renameItem, 'Gym')));
        return api;
    }

    function nameField() {
        return screen.getByLabelText(text.renameInput) as HTMLInputElement;
    }

    it('starts from the current name', async () => {
        await startRename();

        expect(nameField().value).toBe('Gym');
    });

    it('moves the focus into the field, and back to the button when cancelled', async () => {
        await startRename();
        expect(document.activeElement).toBe(nameField());

        fireEvent.click(button(text.cancel));

        expect(document.activeElement).toBe(button(named(text.renameItem, 'Gym')));
    });

    it('saves the new name', async () => {
        const api = await startRename();

        fireEvent.change(nameField(), { target: { value: ' Fitness ' } });
        fireEvent.click(button(text.save));

        expect(await screen.findByText('Fitness')).toBeDefined();
        expect(api.categories).toEqual([{ ...gym, name: 'Fitness' }]);
        expect(screen.queryByLabelText(text.renameInput)).toBeNull();
        expect(screen.queryByText('Gym')).toBeNull();
    });

    it('accepts the same name in another case', async () => {
        const api = await startRename();

        fireEvent.change(nameField(), { target: { value: 'gym' } });
        fireEvent.click(button(text.save));

        expect(await screen.findByText('gym')).toBeDefined();
        expect(api.categories).toEqual([{ ...gym, name: 'gym' }]);
    });

    it('goes back untouched when cancelled', async () => {
        const api = await startRename();

        fireEvent.change(nameField(), { target: { value: 'Fitness' } });
        fireEvent.click(button(text.cancel));

        expect(screen.getByText('Gym')).toBeDefined();
        expect(screen.queryByLabelText(text.renameInput)).toBeNull();
        expect(api.categoryRequests).toEqual([]);
    });

    it('refuses the name of another category', async () => {
        const api = await open({ categories: [gym, plainCategory('Pets')] });
        await screen.findByText('Gym');
        fireEvent.click(button(named(text.renameItem, 'Gym')));

        fireEvent.change(nameField(), { target: { value: 'pets' } });
        fireEvent.click(button(text.save));

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameTaken);
        expect(api.categoryRequests).toEqual([]);
    });

    it('says so when saving fails, and stays open', async () => {
        const api = await startRename();
        api.state.categoryWriteStatus = 500;

        fireEvent.change(nameField(), { target: { value: 'Fitness' } });
        fireEvent.click(button(text.save));

        expect((await screen.findByRole('alert')).textContent).toBe(text.saveFailed);
        expect(nameField().value).toBe('Fitness');
    });
});

describe('deleting', () => {
    async function startDelete() {
        const api = await open({ categories: [gym] });
        await screen.findByText('Gym');
        fireEvent.click(button(named(text.deleteItem, 'Gym')));
        return api;
    }

    it('asks first, and says what happens to its expenses', async () => {
        const api = await startDelete();

        expect(screen.getByText(`Delete Gym? Its expenses will show as ${en.categories.other}.`)).toBeDefined();
        expect(api.categoryRequests).toEqual([]);
    });

    it('puts the focus on Cancel, and back on the button when cancelled', async () => {
        await startDelete();
        expect(document.activeElement).toBe(button(text.cancel));

        fireEvent.click(button(text.cancel));

        expect(document.activeElement).toBe(button(named(text.deleteItem, 'Gym')));
    });

    it('removes the category once confirmed', async () => {
        const api = await startDelete();

        fireEvent.click(button(named(text.deleteItem, 'Gym')));

        expect(await screen.findByText(text.custom.empty)).toBeDefined();
        expect(api.categories).toEqual([]);
        expect(api.categoryRequests).toEqual([`DELETE ${gym.id}`]);
    });

    it('keeps the category when cancelled', async () => {
        const api = await startDelete();

        fireEvent.click(button(text.cancel));

        expect(screen.getByText('Gym')).toBeDefined();
        expect(button(named(text.deleteItem, 'Gym'))).toBeDefined();
        expect(api.categoryRequests).toEqual([]);
    });

    it('says so when deleting fails, and keeps the category', async () => {
        const api = await startDelete();
        api.state.categoryWriteStatus = 500;

        fireEvent.click(button(named(text.deleteItem, 'Gym')));

        expect((await screen.findByRole('alert')).textContent).toBe(text.deleteFailed);
        expect(screen.getByText(/Delete Gym\?/)).toBeDefined();
    });
});

describe('without a connection', () => {
    it('says so and leaves the categories as they are', async () => {
        await open({ categories: [gym] });
        await screen.findByText('Gym');

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        await waitFor(() => expect(button(text.add.submit).disabled).toBe(true));
        expect(button(named(text.renameItem, 'Gym')).disabled).toBe(true);
        expect(button(named(text.deleteItem, 'Gym')).disabled).toBe(true);
    });

    it('lets them be changed again once back online', async () => {
        await open({ categories: [gym] });
        await screen.findByText('Gym');
        onlineManager.setOnline(false);
        await screen.findByText(text.offline);

        onlineManager.setOnline(true);

        await waitFor(() => expect(button(text.add.submit).disabled).toBe(false));
        expect(screen.queryByText(text.offline)).toBeNull();
    });
});
