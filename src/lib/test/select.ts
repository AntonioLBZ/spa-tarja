import { fireEvent, screen, within } from '@testing-library/react';

import { ensureAddSheet, openMoreOptions } from './sheet';

// Drives a select the way a person does, by the label of its field

// A select that is not in the page is one of the add form, which the "+" opens, maybe folded under More options
const trigger = (label: string): HTMLElement => {
    const found = screen.queryByRole('combobox', { name: label });
    if (found) return found;
    ensureAddSheet();
    const inForm = screen.queryByRole('combobox', { name: label });
    if (inForm) return inForm;
    openMoreOptions();
    return screen.getByRole('combobox', { name: label });
};

const optionsOf = (field: HTMLElement): HTMLOptionElement[] => within(field).getAllByRole<HTMLOptionElement>('option');

// The name of the option the field shows
const chosenOption = (label: string): string => {
    return optionsOf(trigger(label)).find((option) => option.selected)?.textContent ?? '';
};

// The names of every option, in order
const optionNames = (label: string): string[] => {
    return optionsOf(trigger(label)).map((option) => option.textContent ?? '');
};

const pickOption = (label: string, name: string): void => {
    const field = trigger(label);
    const option = within(field).getByRole<HTMLOptionElement>('option', { name });
    fireEvent.change(field, { target: { value: option.value } });
};

export { chosenOption, optionNames, pickOption, trigger };
