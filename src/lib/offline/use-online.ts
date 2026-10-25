import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
    return onlineManager.subscribe(listener);
}

function isOnline() {
    return onlineManager.isOnline();
}

// What the browser says about the connection, which Query follows
function useOnline(): boolean {
    return useSyncExternalStore(subscribe, isOnline);
}

export { useOnline };
