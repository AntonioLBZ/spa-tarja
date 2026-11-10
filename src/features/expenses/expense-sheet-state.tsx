import { createContext, use, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SharedRowSource } from '@/features/groups/use-shared-expense-rows';
import type { Expense } from '@core/expense';

// What the form copies into a new expense: the expense, or every part of its plan. `serial` tells one press of
// Duplicate from the next, so pressing it again starts over.
interface Copy {
    parts: readonly Expense[];
    serial: number;
}

// A shared expense, with its group, that the form copies into a new one of that group
interface EntryCopy extends SharedRowSource {
    serial: number;
}

interface ExpenseSheetState {
    open: boolean;
    // Closes the sheet. An add keeps what was typed; an edit or a copy ends, as Cancel does.
    close: () => void;
    // Opens the sheet on a new expense
    openAdd: () => void;
    // A new expense was saved: the sheet closes. The form has emptied itself, so the next "+" starts a new one.
    endAdd: () => void;
    // Changes when the next add must start a new form rather than keep the one in the page
    addKey: number;
    // The form tells whether it holds a draft worth keeping
    markDraft: (drafting: boolean) => void;
    // The expense, or every part of its plan, that the form is editing; null while it adds a new one
    editing: readonly Expense[] | null;
    // Loads the expense into the form and opens the sheet
    startEdit: (parts: readonly Expense[]) => void;
    // Back to adding, and the sheet closed. After Save or Cancel, `refocus` hands the focus back to the row.
    endEdit: (options?: { refocus?: boolean }) => void;
    // What the form is copying into a new expense; null otherwise. Never together with `editing`.
    copying: Copy | null;
    // Loads the expense into the form as a new one and opens the sheet
    startCopy: (parts: readonly Expense[]) => void;
    // Back to adding, and the sheet closed. After Add or Cancel, `refocus` hands the focus back to the row copied.
    endCopy: (options?: { refocus?: boolean }) => void;
    // The shared expense of a row, with its group, that the form is editing or copying, never together with anything
    // else; `endEdit` and `endCopy` end them too
    editingEntry: SharedRowSource | null;
    startEditEntry: (source: SharedRowSource) => void;
    copyingEntry: EntryCopy | null;
    startCopyEntry: (source: SharedRowSource) => void;
    // The expense or entry was deleted: an edit or a copy of it is over
    forget: (id: string) => void;
    // The expense whose row should take the focus, until the list has given it
    refocus: string | null;
    clearRefocus: () => void;
    // The last expense the form has added, a new object each time; the list watches it to drop the filters that would
    // hide the new one
    added: { day: string } | null;
    noteAdded: (day: string) => void;
}

const ExpenseSheetContext = createContext<ExpenseSheetState | null>(null);

interface ExpenseSheetProviderProps {
    children: ReactNode;
}

// Whether the sheet of the expense form is open, and what it is editing or copying. In memory only. It lives above the
// routes because the "+" opens it from any screen.
const ExpenseSheetProvider = (props: ExpenseSheetProviderProps) => {
    const { children } = props;
    const [open, setOpen] = useState(false);
    const [addKey, setAddKey] = useState(0);
    const [editing, setEditing] = useState<readonly Expense[] | null>(null);
    const [copying, setCopying] = useState<Copy | null>(null);
    const [editingEntry, setEditingEntry] = useState<SharedRowSource | null>(null);
    const [copyingEntry, setCopyingEntry] = useState<EntryCopy | null>(null);
    const copies = useRef(0);
    const drafting = useRef(false);
    const [refocus, setRefocus] = useState<string | null>(null);
    const [added, setAdded] = useState<{ day: string } | null>(null);

    const value = useMemo<ExpenseSheetState>(() => {
        const endEdit = (options: { refocus?: boolean } = {}) => {
            if (editing === null && editingEntry === null) return;
            const id = editing?.[0]!.id ?? editingEntry?.entry.id;
            if (options.refocus && id !== undefined) setRefocus(id);
            setEditing(null);
            setEditingEntry(null);
            setOpen(false);
        };

        const endCopy = (options: { refocus?: boolean } = {}) => {
            if (copying === null && copyingEntry === null) return;
            const id = copying?.parts[0]!.id ?? copyingEntry?.entry.id;
            if (options.refocus && id !== undefined) setRefocus(id);
            setCopying(null);
            setCopyingEntry(null);
            setOpen(false);
        };

        // Whatever the form was editing or copying gives way to what it starts now
        const clear = () => {
            setEditing(null);
            setCopying(null);
            setEditingEntry(null);
            setCopyingEntry(null);
        };

        return {
            open,
            close: () => {
                if (editing || editingEntry || copying || copyingEntry) {
                    endEdit({ refocus: true });
                    endCopy({ refocus: true });
                    return;
                }
                setOpen(false);
            },
            openAdd: () => {
                clear();
                if (!drafting.current) setAddKey((key) => key + 1);
                setOpen(true);
            },
            endAdd: () => setOpen(false),
            addKey,
            markDraft: (isDrafting: boolean) => {
                drafting.current = isDrafting;
            },
            editing,
            startEdit: (parts: readonly Expense[]) => {
                clear();
                setEditing(parts);
                setOpen(true);
            },
            endEdit,
            copying,
            startCopy: (parts: readonly Expense[]) => {
                clear();
                setCopying({ parts, serial: ++copies.current });
                setOpen(true);
            },
            endCopy,
            editingEntry,
            startEditEntry: (source: SharedRowSource) => {
                clear();
                setEditingEntry(source);
                setOpen(true);
            },
            copyingEntry,
            startCopyEntry: (source: SharedRowSource) => {
                clear();
                setCopyingEntry({ ...source, serial: ++copies.current });
                setOpen(true);
            },
            forget: (id: string) => {
                if (editing?.[0]?.id === id || editingEntry?.entry.id === id) endEdit();
                if (copying?.parts[0]?.id === id || copyingEntry?.entry.id === id) endCopy();
            },
            refocus,
            clearRefocus: () => setRefocus(null),
            added,
            noteAdded: (day: string) => setAdded({ day }),
        };
    }, [open, addKey, editing, copying, editingEntry, copyingEntry, refocus, added]);

    return <ExpenseSheetContext value={value}>{children}</ExpenseSheetContext>;
};

const useExpenseSheet = (): ExpenseSheetState => {
    const value = use(ExpenseSheetContext);
    if (value === null) throw new Error('useExpenseSheet needs an ExpenseSheetProvider');
    return value;
};

export { ExpenseSheetProvider, useExpenseSheet, type ExpenseSheetProviderProps, type ExpenseSheetState };
