import { useTranslations } from 'use-intl';

import { Disclosure } from '@/components/disclosure/disclosure';

import { useAddForm } from './add-form-state';
import { ExpenseForm } from './expense-form';

// The add form under a heading that collapses it. The form stays in the page while collapsed, so the draft survives.
function AddExpense() {
    const t = useTranslations('expenses.form');
    const { open, setOpen } = useAddForm();

    return (
        <Disclosure
            as="section"
            heading="h2"
            summary={t('title')}
            chevron
            keepMounted
            open={open}
            onOpenChange={setOpen}
        >
            <ExpenseForm />
        </Disclosure>
    );
}

export { AddExpense };
