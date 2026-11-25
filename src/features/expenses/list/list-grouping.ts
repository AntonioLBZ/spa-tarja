import { DEFAULT_LIST_GROUPING, isListGrouping, type ListGrouping } from '@core/expense-list';

const STORAGE_KEY = 'tarja:list-grouping';

const readStoredGrouping = (): ListGrouping => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isListGrouping(stored) ? stored : DEFAULT_LIST_GROUPING;
    } catch {
        return DEFAULT_LIST_GROUPING;
    }
};

const storeGrouping = (grouping: ListGrouping): void => {
    try {
        localStorage.setItem(STORAGE_KEY, grouping);
    } catch {
        // Storage can be blocked; the choice then lasts for the session only
    }
};

export { readStoredGrouping, storeGrouping };
