import { createContext, use, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Expense } from '@core/expense';

// What the form copies into a new expense: the expense, or every part of its plan. `serial` tells one press of
// Duplicate from the next, so pressing it again starts over.
interface Copy {
    parts: readonly Expense[];
    serial: number;
}

interface AddFormState {
    open: boolean;
    setOpen: (open: boolean) => void;
    // The expense, or every part of its plan, that the form is editing; null while it adds a new one
    editing: readonly Expense[] | null;
    // Loads the expense into the form and opens it
    startEdit: (parts: readonly Expense[]) => void;
    // Back to adding. After Save or Cancel, `refocus` hands the focus back to the row of the expense.
    endEdit: (options?: { refocus?: boolean }) => void;
    // What the form is copying into a new expense; null otherwise. Never together with `editing`.
    copying: Copy | null;
    // Loads the expense into the form as a new one and opens it
    startCopy: (parts: readonly Expense[]) => void;
    // Back to adding. After Add or Cancel, `refocus` hands the focus back to the row that was copied.
    endCopy: (options?: { refocus?: boolean }) => void;
    // The expense whose row should take the focus, until the list has given it
    refocus: string | null;
    clearRefocus: () => void;
    // How many expenses the form has added; the list watches it to drop the filters that would hide the new one
    added: number;
    noteAdded: () => void;
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
    const [copying, setCopying] = useState<Copy | null>(null);
    const copies = useRef(0);
    const [refocus, setRefocus] = useState<string | null>(null);
    const [added, setAdded] = useState(0);

    const value = useMemo(() => {
        function endEdit(options: { refocus?: boolean } = {}) {
            if (options.refocus && editing) setRefocus(editing[0]!.id);
            setEditing(null);
        }

        function endCopy(options: { refocus?: boolean } = {}) {
            if (options.refocus && copying) setRefocus(copying.parts[0]!.id);
            setCopying(null);
        }

        return {
            open,
            setOpen,
            editing,
            startEdit: (parts: readonly Expense[]) => {
                setCopying(null);
                setEditing(parts);
                setOpen(true);
            },
            endEdit,
            copying,
            startCopy: (parts: readonly Expense[]) => {
                setEditing(null);
                setCopying({ parts, serial: ++copies.current });
                setOpen(true);
            },
            endCopy,
            refocus,
            clearRefocus: () => setRefocus(null),
            added,
            noteAdded: () => setAdded((count) => count + 1),
            collapse: () => {
                endEdit();
                endCopy();
                setOpen(false);
            },
            reveal: () => {
                endEdit();
                endCopy();
                setOpen(true);
            },
        };
    }, [open, editing, copying, refocus, added]);

    return <AddFormContext value={value}>{children}</AddFormContext>;
}

function useAddForm(): AddFormState {
    const value = use(AddFormContext);
    if (value === null) throw new Error('useAddForm needs an AddFormProvider');
    return value;
}

export { AddFormProvider, useAddForm };
