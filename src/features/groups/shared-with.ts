const STORAGE_KEY = 'tarja:shared-with';

// The group or friend the person last shared an expense with on this device
const readSharedWith = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
};

const rememberSharedWith = (groupId: string): void => {
    try {
        localStorage.setItem(STORAGE_KEY, groupId);
    } catch {
        // Storage can be blocked; the form then starts on the first group
    }
};

// Once the account is deleted, the group no longer exists for anybody on this device
const forgetSharedWith = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing stored, nothing to forget
    }
};

export { forgetSharedWith, readSharedWith, rememberSharedWith };
