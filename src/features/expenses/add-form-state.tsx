import { createContext, use, useMemo, useState, type ReactNode } from 'react';

interface AddFormState {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const AddFormContext = createContext<AddFormState | null>(null);

// Whether the add form on the home screen is open. In memory only, so the app always starts with it open. It lives
// above the routes because the header opens and collapses it, also from another screen.
function AddFormProvider(props: { children: ReactNode }) {
    const { children } = props;
    const [open, setOpen] = useState(true);
    const value = useMemo(() => ({ open, setOpen }), [open]);

    return <AddFormContext value={value}>{children}</AddFormContext>;
}

function useAddForm(): AddFormState {
    const value = use(AddFormContext);
    if (value === null) throw new Error('useAddForm needs an AddFormProvider');
    return value;
}

export { AddFormProvider, useAddForm };
export type { AddFormState };
