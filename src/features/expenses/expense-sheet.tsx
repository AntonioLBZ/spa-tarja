import { useRouterState } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Dialog } from '@/components/dialog/dialog';
import { useToast } from '@/components/toast/toast';

import { ExpenseForm } from './expense-form';
import { useExpenseSheet } from './expense-sheet-state';

// The expense form in a sheet. It is built on the first "+" and stays in the page afterwards, so what was typed
// survives closing it. Editing or duplicating an expense loads it into the same form, which a new key puts back to
// adding once that is over.
const ExpenseSheet = () => {
    const t = useTranslations('expenses.form');
    const toast = useToast();
    const away = useRouterState({ select: (state) => state.location.pathname !== '/' });
    const {
        open,
        close,
        addKey,
        markDraft,
        endAdd,
        editing,
        copying,
        editingEntry,
        copyingEntry,
        startGroup,
        endEdit,
        endCopy,
        noteAdded,
    } = useExpenseSheet();
    const body = useRef<HTMLDivElement>(null);
    const [built, setBuilt] = useState(false);
    if (open && !built) setBuilt(true);
    if (!built) return null;

    const isEdit = editing !== null || editingEntry !== null;
    const isCopy = copying !== null || copyingEntry !== null;
    const title = isEdit ? t('editTitle') : isCopy ? t('copyTitle') : t('title');
    // A shared expense is changed or copied in its group, which the form then holds fixed
    const entry = editingEntry ?? copyingEntry;
    const key =
        editing?.[0]!.id ??
        editingEntry?.entry.id ??
        (copying ? `copy-${copying.serial}` : copyingEntry ? `copy-${copyingEntry.serial}` : `new-${addKey}`);

    // The list shows a new expense on the home screen; anywhere else a toast says it was added. A budget warning that
    // comes right after replaces the toast.
    const handleAdded = (day: string) => {
        noteAdded(day);
        if (away) toast.show({ icon: 'check', message: t('added') });
        if (!isCopy) endAdd();
    };

    return (
        <Dialog
            open={open}
            variant="sheet"
            title={title}
            closeLabel={t('close')}
            initialFocus={() => (isEdit || isCopy ? null : (body.current?.querySelector('input') ?? null))}
            onClose={() => {
                if (open) close();
            }}
        >
            <div ref={body}>
                <ExpenseForm
                    key={key}
                    title={title}
                    group={entry?.group}
                    startGroup={isEdit || isCopy ? undefined : (startGroup ?? undefined)}
                    editing={editing}
                    copying={copying?.parts ?? null}
                    editingEntry={editingEntry?.entry ?? null}
                    copyingEntry={copyingEntry?.entry ?? null}
                    onDone={() => {
                        endEdit({ refocus: true });
                        endCopy({ refocus: true });
                    }}
                    onAdded={handleAdded}
                    onDraftChange={markDraft}
                />
            </div>
        </Dialog>
    );
};

export { ExpenseSheet };
