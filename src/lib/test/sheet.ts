import { fireEvent, screen } from '@testing-library/react';

import en from '@/assets/locales/en.json';

// The "+" is in the bar or floating, never inside a screen
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

export { ensureAddSheet, openAddSheet };
