const STORAGE_KEY = 'tarja:shared-with';

// Under the user, like the rest of what an account keeps on a device
const keyOf = (userId: string) => `${STORAGE_KEY}:${userId}`;

// The group or friend the person last shared an expense with on this device
const readSharedWith = (userId: string): string | null => {
    try {
        return localStorage.getItem(keyOf(userId));
    } catch {
        return null;
    }
};

const rememberSharedWith = (userId: string, groupId: string): void => {
    try {
        localStorage.setItem(keyOf(userId), groupId);
    } catch {
        // Storage can be blocked; the form then starts on the first group
    }
};

// With the rest of the user's local data: once it is deleted the group is no longer chosen
const forgetSharedWith = (userId: string): void => {
    try {
        localStorage.removeItem(keyOf(userId));
    } catch {
        // Nothing stored, nothing to forget
    }
};

export { forgetSharedWith, readSharedWith, rememberSharedWith };
