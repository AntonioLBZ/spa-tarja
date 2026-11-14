import type { Notice } from '@core/notices';
import type { QueryClient } from '@tanstack/react-query';

type NoticeListener = (notices: readonly Notice[]) => void;

// The listeners of each signed-in user, by their query client, which is the user's own
const listeners = new WeakMap<QueryClient, Set<NoticeListener>>();

// Hands what a pull told to whoever listens for that user
const emitNotices = (client: QueryClient, notices: readonly Notice[]) => {
    if (notices.length === 0) return;
    for (const listener of listeners.get(client) ?? []) listener(notices);
};

const subscribeNotices = (client: QueryClient, listener: NoticeListener): (() => void) => {
    const set = listeners.get(client) ?? new Set<NoticeListener>();
    listeners.set(client, set);
    set.add(listener);
    return () => set.delete(listener);
};

export { emitNotices, subscribeNotices, type NoticeListener };
