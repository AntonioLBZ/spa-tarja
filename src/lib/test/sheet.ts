import { fireEvent, screen } from '@testing-library/react';

import en from '@/assets/locales/en.json';

// Presses the "+" and gives the sheet of the add form that opens
const openAddSheet = async (): Promise<HTMLElement> => {
    fireEvent.click(await screen.findByRole('button', { name: en.nav.add }));
    return screen.findByRole('dialog', { name: en.expenses.form.title });
};

// The sheet that is open, else the one the "+" opens: for tests about the form, not about how it opens
const ensureAddSheet = (): HTMLElement => {
    const open = screen.queryByRole('dialog');
    if (open) return open;
    fireEvent.click(screen.getByRole('button', { name: en.nav.add }));
    return screen.getByRole('dialog', { name: en.expenses.form.title });
};

export { ensureAddSheet, openAddSheet };
