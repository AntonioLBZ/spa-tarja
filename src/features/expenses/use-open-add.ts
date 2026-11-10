import { useExpenseSheet } from './expense-sheet-state';

// What the "+" does: opens the sheet on a new expense
const useOpenAdd = (): (() => void) => {
    const { openAdd } = useExpenseSheet();
    return openAdd;
};

export { useOpenAdd };
