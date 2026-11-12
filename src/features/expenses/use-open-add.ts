import { useScreenGroup } from '@/features/groups/use-screen-group';

import { useExpenseSheet } from './expense-sheet-state';

// What the "+" does: opens the sheet on a new expense, starting in the group of the screen when it is in one
const useOpenAdd = (): (() => void) => {
    const { openAdd } = useExpenseSheet();
    const group = useScreenGroup();

    return () => openAdd({ group });
};

export { useOpenAdd };
