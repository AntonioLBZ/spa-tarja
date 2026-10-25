import { fireEvent, screen, within } from '@testing-library/react';

// Drives the category select the way a person does, by the label of its field

function trigger(label: string): HTMLElement {
    return screen.getByRole('combobox', { name: label });
}

// The name of the category the field shows
function chosenCategory(label: string): string {
    return trigger(label).textContent ?? '';
}

function openCategories(label: string): HTMLElement {
    const field = trigger(label);
    if (field.getAttribute('aria-expanded') !== 'true') fireEvent.click(field);
    return screen.getByRole('listbox', { name: label });
}

// The names of every option, in order
function categoryNames(label: string): string[] {
    const list = openCategories(label);
    const names = within(list)
        .getAllByRole('option')
        .map((option) => option.textContent ?? '');
    fireEvent.keyDown(trigger(label), { key: 'Escape' });
    return names;
}

function pickCategory(label: string, name: string): void {
    const list = openCategories(label);
    fireEvent.click(within(list).getByRole('option', { name }));
}

export { categoryNames, chosenCategory, openCategories, pickCategory, trigger };
