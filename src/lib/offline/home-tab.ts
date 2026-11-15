const STORAGE_KEY = 'tarja:home-tab';

// Under the user, like the rest of what an account keeps on a device
const keyOf = (userId: string) => `${STORAGE_KEY}:${userId}`;

// The pinned group whose tab of the Expenses screen was shown last on this device, null for Expenses
const readHomeTab = (userId: string): string | null => {
    try {
        return localStorage.getItem(keyOf(userId));
    } catch {
        return null;
    }
};

const rememberHomeTab = (userId: string, groupId: string | null): void => {
    try {
        if (groupId === null) localStorage.removeItem(keyOf(userId));
        else localStorage.setItem(keyOf(userId), groupId);
    } catch {
        // Storage can be blocked; the app then opens on Expenses
    }
};

const forgetHomeTab = (userId: string): void => {
    rememberHomeTab(userId, null);
};

interface HomeTab {
    // Told what the Expenses screen shows: the group asked by the address and the pinned one shown, if any. Answers the
    // group to go to when the app opens, once per load and only when the address names none.
    follow: (asked: string | undefined, shown: string | null) => string | null;
    // The group of the tab shown last, null for Expenses: where the links home lead
    last: () => string | null;
    subscribe: (listener: () => void) => () => void;
}

// The tab the Expenses screen opens on: the one shown last, kept as the person moves between tabs
const createHomeTab = (userId: string): HomeTab => {
    let phase: 'opening' | 'landing' | 'open' = 'opening';
    let target: string | null = null;
    let last = readHomeTab(userId);
    const listeners = new Set<() => void>();

    const remember = (groupId: string | null) => {
        if (groupId === last) return;
        last = groupId;
        rememberHomeTab(userId, groupId);
        listeners.forEach((listener) => listener());
    };

    return {
        follow: (asked, shown) => {
            if (phase === 'opening') {
                target = asked ? null : last;
                phase = target === null ? 'open' : 'landing';
                if (target !== null) return target;
            }
            // What is shown before the address names the tab gone to is no choice of the person's
            if (phase === 'landing') {
                if (!asked) return null;
                phase = 'open';
            }
            if (shown !== null) remember(shown);
            else if (!asked) remember(null);
            return null;
        },
        last: () => last,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
};

export { createHomeTab, forgetHomeTab, readHomeTab, rememberHomeTab, type HomeTab };
