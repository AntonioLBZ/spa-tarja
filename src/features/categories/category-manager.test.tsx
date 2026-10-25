import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
        expect(screen.queryByRole('button', { name: named(text.editItem, en.categories.food) })).toBeNull();
        expect(screen.queryByRole('button', { name: named(text.deleteItem, en.categories.food) })).toBeNull();
    });

    it('shows the look of every category, the built-in ones and the person’s own', async () => {
        await open({ categories: [gym, plainCategory('Pets')] });
        await screen.findByText('Gym');

        const row = (label: string) => screen.getByText(label).closest('li')!;
        const look = (label: string) => {
            const element = row(label);
            return {
                icon: element.querySelector('[data-icon]')?.getAttribute('data-icon'),
                color: /category-badge--(\w+)/.exec(element.querySelector('.category-badge')?.className ?? '')?.[1],
            };
        };
        expect(look(en.categories.food)).toEqual({ icon: 'restaurant', color: 'vermillion' });
        expect(look(en.categories.other)).toEqual({ icon: 'more_horiz', color: 'gray' });
        expect(look('Gym')).toEqual({ icon: 'fitness_center', color: 'blue' });
        expect(look('Pets')).toEqual({ icon: 'category', color: 'gray' });
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

function radio(name: string) {
    return screen.getByRole('radio', { name }) as HTMLInputElement;
}

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

    it('offers a color and an icon, starting from the next color and the generic icon', async () => {
        await open();
        await screen.findByText(text.custom.empty);

        expect(screen.getByText(text.look.summary)).toBeDefined();
        expect(radio(en.categoryColors.vermillion).checked).toBe(true);
        expect(radio(en.categoryIcons.category).checked).toBe(true);
    });

    it('creates the category with the color and the icon that were picked', async () => {
        const api = await open();
        await screen.findByText(text.custom.empty);

        fireEvent.click(radio(en.categoryColors.purple));
        fireEvent.click(radio(en.categoryIcons.pets));
        add('Pets');

        expect(await screen.findByText('Pets')).toBeDefined();
        expect(api.categories).toEqual([{ id: expect.any(String), name: 'Pets', color: 'purple', icon: 'pets' }]);
    });

    it('goes back to the next free color for the following category', async () => {
        await open();
        await screen.findByText(text.custom.empty);
        fireEvent.click(radio(en.categoryColors.purple));
        add('Pets');
        await screen.findByText('Pets');

        expect(radio(en.categoryColors.vermillion).checked).toBe(true);
        expect(radio(en.categoryIcons.category).checked).toBe(true);
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

describe('editing', () => {
    async function startRename() {
        const api = await open({ categories: [gym] });
        await screen.findByText('Gym');
        fireEvent.click(button(named(text.editItem, 'Gym')));
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

        expect(document.activeElement).toBe(button(named(text.editItem, 'Gym')));
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

    function rowRadio(name: string) {
        return within(nameField().closest('li')!).getByRole('radio', { name }) as HTMLInputElement;
    }

    it('starts from the current color and icon', async () => {
        await startRename();

        expect(rowRadio(en.categoryColors.blue).checked).toBe(true);
        expect(rowRadio(en.categoryIcons.fitness_center).checked).toBe(true);
    });

    it('saves a new color and icon with the name', async () => {
        const api = await startRename();

        fireEvent.click(rowRadio(en.categoryColors.green));
        fireEvent.click(rowRadio(en.categoryIcons.spa));
        fireEvent.click(button(text.save));

        await waitFor(() => expect(screen.queryByLabelText(text.renameInput)).toBeNull());
        expect(api.categories).toEqual([{ id: gym.id, name: 'Gym', color: 'green', icon: 'spa' }]);
        const row = screen.getByText('Gym').closest('li')!;
        expect(row.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('spa');
        expect(row.querySelector('.category-badge')?.className).toContain('category-badge--green');
    });

    it('drops a color and icon change when cancelled', async () => {
        const api = await startRename();

        fireEvent.click(rowRadio(en.categoryColors.green));
        fireEvent.click(button(text.cancel));
        fireEvent.click(button(named(text.editItem, 'Gym')));

        expect(rowRadio(en.categoryColors.blue).checked).toBe(true);
        expect(api.categoryRequests).toEqual([]);
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
        fireEvent.click(button(named(text.editItem, 'Gym')));

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
        expect(button(named(text.editItem, 'Gym')).disabled).toBe(true);
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
