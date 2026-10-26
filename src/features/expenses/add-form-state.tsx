import { createContext, use, useMemo, useState, type ReactNode } from 'react';

import type { Expense } from '@core/expense';

interface AddFormState {
    open: boolean;
    setOpen: (open: boolean) => void;
    // The expense, or every part of its plan, that the form is editing; null while it adds a new one
    editing: readonly Expense[] | null;
    // Loads the expense into the form and opens it
    startEdit: (parts: readonly Expense[]) => void;
    // Back to adding. After Save or Cancel, `refocus` hands the focus back to the row of the expense.
    endEdit: (options?: { refocus?: boolean }) => void;
    // The expense whose row should take the focus, until the list has given it
    refocus: string | null;
    clearRefocus: () => void;
    // The header's Expenses: the form collapsed, adding
    collapse: () => void;
    // The logo: the form open, adding
    reveal: () => void;
}

const AddFormContext = createContext<AddFormState | null>(null);

// Whether the add form on the home screen is open, and what it is editing. In memory only, so the app always starts
// with it open and adding. It lives above the routes because the header opens and collapses it, also from another
// screen.
function AddFormProvider(props: { children: ReactNode }) {
    const { children } = props;
    const [open, setOpen] = useState(true);
    const [editing, setEditing] = useState<readonly Expense[] | null>(null);
    const [refocus, setRefocus] = useState<string | null>(null);

    const value = useMemo(() => {
        function endEdit(options: { refocus?: boolean } = {}) {
            if (options.refocus && editing) setRefocus(editing[0]!.id);
            setEditing(null);
        }

        return {
            open,
            setOpen,
            editing,
            startEdit: (parts: readonly Expense[]) => {
                setEditing(parts);
                setOpen(true);
            },
            endEdit,
            refocus,
            clearRefocus: () => setRefocus(null),
            collapse: () => {
                endEdit();
                setOpen(false);
            },
            reveal: () => {
                endEdit();
                setOpen(true);
            },
        };
    }, [open, editing, refocus]);

    return <AddFormContext value={value}>{children}</AddFormContext>;
}

function useAddForm(): AddFormState {
    const value = use(AddFormContext);
    if (value === null) throw new Error('useAddForm needs an AddFormProvider');
    return value;
}

export { AddFormProvider, useAddForm };
export type { AddFormState };
