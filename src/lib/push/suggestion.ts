const STORAGE_KEY = 'tarja:push-suggestion';

// Under the user, like the rest of what an account keeps on a device
const keyOf = (userId: string) => `${STORAGE_KEY}:${userId}`;

// Whether the person answered the suggestion to turn notifications on, on this device
const pushSuggestionAnswered = (userId: string): boolean => {
    try {
        return localStorage.getItem(keyOf(userId)) !== null;
    } catch {
        return false;
    }
};

const answerPushSuggestion = (userId: string): void => {
    try {
        localStorage.setItem(keyOf(userId), 'answered');
    } catch {
        // Storage can be blocked; the suggestion then comes back on the next visit
    }
};

// With the rest of the user's local data
const forgetPushSuggestion = (userId: string): void => {
    try {
        localStorage.removeItem(keyOf(userId));
    } catch {
        // Nothing stored, nothing to forget
    }
};

export { answerPushSuggestion, forgetPushSuggestion, pushSuggestionAnswered };
