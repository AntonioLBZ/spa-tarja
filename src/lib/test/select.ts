import { fireEvent, screen, within } from '@testing-library/react';

// Drives a select the way a person does, by the label of its field

function trigger(label: string): HTMLElement {
    return screen.getByRole('combobox', { name: label });
}

// The name of the option the field shows
function chosenOption(label: string): string {
    return trigger(label).textContent ?? '';
}

function openOptions(label: string): HTMLElement {
    const field = trigger(label);
    if (field.getAttribute('aria-expanded') !== 'true') fireEvent.click(field);
    return screen.getByRole('listbox', { name: label });
}

// The names of every option, in order
function optionNames(label: string): string[] {
    const list = openOptions(label);
    const names = within(list)
        .getAllByRole('option')
        .map((option) => option.textContent ?? '');
    fireEvent.keyDown(trigger(label), { key: 'Escape' });
    return names;
}

function pickOption(label: string, name: string): void {
    const list = openOptions(label);
    fireEvent.click(within(list).getByRole('option', { name }));
}

export { chosenOption, openOptions, optionNames, pickOption, trigger };
