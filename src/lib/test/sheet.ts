import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';

// The "+" is in the bar or in the header, never inside a screen
const isPlus = (button: HTMLElement) => button.closest('main') === null;

// Presses the "+" and gives the sheet of the add form that opens
const openAddSheet = async (): Promise<HTMLElement> => {
    const buttons = await screen.findAllByRole('button', { name: en.nav.add });
    fireEvent.click(buttons.find(isPlus)!);
    return screen.findByRole('dialog', { name: en.expenses.form.title });
};

// The sheet that is open, else the one the "+" opens: for tests about the form, not about how it opens
const ensureAddSheet = (): HTMLElement => {
    const open = screen.queryByRole('dialog');
    if (open) return open;
    fireEvent.click(screen.getAllByRole('button', { name: en.nav.add }).find(isPlus)!);
    return screen.getByRole('dialog', { name: en.expenses.form.title });
};

// Opens More options of the add form when it is folded, for a test about what it holds
const openMoreOptions = (): void => {
    const toggle = screen.queryByRole('button', { name: new RegExp(`^${en.expenses.form.moreOptions}`) });
    if (toggle?.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
};

// Presses Close on the sheet that is open: the page behind it answers nothing until then
const closeSheet = async () => {
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en.expenses.form.close }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
};

export { closeSheet, ensureAddSheet, openAddSheet, openMoreOptions };
