import { useRouterState } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Icon } from '@/components/icon/icon';
import { useToast } from '@/components/toast/toast';
import { useWide } from '@/lib/use-wide';

import { ExpenseForm } from './expense-form';
import { useExpenseSheet } from './expense-sheet-state';

import './expense-sheet.css';

// The expense form in a sheet, built on the first "+". Every "+" starts a new, empty form, so closing it drops what
// was typed (ADR-0026). Editing or duplicating an expense loads it into the same form, which a new key puts back to
// adding once that is over.
const ExpenseSheet = () => {
    const t = useTranslations('expenses.form');
    const toast = useToast();
    const away = useRouterState({ select: (state) => state.location.pathname !== '/' });
    const {
        open,
        close,
        addKey,
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
    const formId = useId();
    const wide = useWide();
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
    const handleDone = () => {
        endEdit({ refocus: true });
        endCopy({ refocus: true });
    };

    // A box at the foot of the dialog, a check at the end of the title row of a phone
    const submit = wide ? (
        <Button className="expense-sheet__submit" variant="primary" form={formId} type="submit">
            {isEdit ? t('save') : t('submit')}
        </Button>
    ) : (
        <Button
            ghost
            glyph
            className="expense-sheet__check"
            aria-label={isEdit ? t('save') : t('submit')}
            form={formId}
            type="submit"
        >
            <Icon name="check" />
        </Button>
    );

    const handleAdded = (day: string) => {
        noteAdded(day);
        if (away) toast.show({ icon: 'check', message: t('added') });
        if (!isCopy) endAdd();
    };

    return (
        <Dialog
            open={open}
            variant={wide ? 'sheet' : 'page'}
            title={title}
            closeLabel={t('close')}
            // Closing drops what was typed, so a stray tap on the veil doesn't close it
            closeOnOutside={false}
            initialFocus={() => (isEdit || isCopy ? null : (body.current?.querySelector('input') ?? null))}
            onClose={() => {
                if (open) close();
            }}
            // The form's button stays in sight (ADR-0026): in the title row of a phone, which the form takes whole,
            // and stuck to the foot of the dialog from 40 rem
            headAction={wide ? undefined : submit}
            actions={
                wide ? (
                    <>
                        {submit}
                        {(isEdit || isCopy) && (
                            <Button ghost onClick={handleDone}>
                                {t('cancel')}
                            </Button>
                        )}
                    </>
                ) : undefined
            }
        >
            <div ref={body}>
                <ExpenseForm
                    key={key}
                    id={formId}
                    title={title}
                    group={entry?.group}
                    startGroup={isEdit || isCopy ? undefined : (startGroup ?? undefined)}
                    editing={editing}
                    copying={copying?.parts ?? null}
                    editingEntry={editingEntry?.entry ?? null}
                    copyingEntry={copyingEntry?.entry ?? null}
                    onDone={handleDone}
                    onAdded={handleAdded}
                />
            </div>
        </Dialog>
    );
};

export { ExpenseSheet };
