import { useRef, useState } from 'react';

import type { SharedExpenseEntry } from '@core/shared-expense';

// What the form copies into a new expense; `serial` tells one press of Duplicate from the next, so pressing it again
// starts over
interface EntryCopy {
    entry: SharedExpenseEntry;
    serial: number;
}

// Whether the add form of a group is open, and the expense of the ledger it edits or copies, never both. When that is
// over, the row of the entry takes the focus back, or the title of the ledger when the row is gone.
const useLedgerForm = () => {
    // Collapsed under its heading to start with
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<SharedExpenseEntry | null>(null);
    const [copying, setCopying] = useState<EntryCopy | null>(null);
    const copies = useRef(0);
    // The entry whose row should take the focus, until the ledger has given it
    const [refocus, setRefocus] = useState<string | null>(null);

    return {
        open,
        setOpen,
        editing,
        copying: copying?.entry ?? null,
        // Tells one form from the next, so that another edit or copy starts over and adding starts empty
        key: editing ? `edit-${editing.id}` : copying ? `copy-${copying.serial}` : 'new',
        startEdit: (entry: SharedExpenseEntry) => {
            setCopying(null);
            setEditing(entry);
            setOpen(true);
        },
        startCopy: (entry: SharedExpenseEntry) => {
            setEditing(null);
            setCopying({ entry, serial: ++copies.current });
            setOpen(true);
        },
        // After Save, Add or Cancel: back to adding, the focus on the row
        end: () => {
            setRefocus((editing ?? copying?.entry)?.id ?? null);
            setEditing(null);
            setCopying(null);
        },
        // The entry was deleted: an edit of it is over
        forget: (entryId: string) => {
            if (editing?.id === entryId) setEditing(null);
        },
        refocus,
        setRefocus,
    };
};

export { useLedgerForm };
