import { useEffect, useRef } from 'react';
import { useTranslations } from 'use-intl';

import { Disclosure } from '@/components/disclosure/disclosure';
import { readDuration } from '@/lib/motion';

import { useAddForm } from './add-form-state';
import { ExpenseForm } from './expense-form';

// The add form under a heading that collapses it. The form stays in the page while collapsed, so the draft survives.
// Editing or duplicating an expense loads it into the same form, which a new key puts back to adding once that is over.
function AddExpense() {
    const t = useTranslations('expenses.form');
    const { open, setOpen, editing, copying, endEdit, endCopy, noteAdded } = useAddForm();
    const heading = useRef<HTMLButtonElement>(null);
    const title = editing ? t('editTitle') : copying ? t('copyTitle') : t('title');

    // Edit and Duplicate bring the form into view and put the focus on its heading, never on a field: a phone would
    // open its keyboard
    useEffect(() => {
        if (!editing && !copying) return;
        const behavior = readDuration('--duration-base') === 0 ? 'instant' : 'smooth';
        heading.current?.scrollIntoView({ behavior, block: 'start' });
        heading.current?.focus({ preventScroll: true });
    }, [editing, copying]);

    return (
        <Disclosure
            as="section"
            heading="h2"
            summary={title}
            chevron
            keepMounted
            open={open}
            onOpenChange={setOpen}
            toggleRef={heading}
        >
            <ExpenseForm
                key={editing?.[0]!.id ?? (copying ? `copy-${copying.serial}` : 'new')}
                title={title}
                editing={editing}
                copying={copying?.parts ?? null}
                onDone={() => {
                    endEdit({ refocus: true });
                    endCopy({ refocus: true });
                }}
                onAdded={noteAdded}
            />
        </Disclosure>
    );
}

export { AddExpense };
