import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => {
    return onlineManager.subscribe(listener);
};

const isOnline = () => {
    return onlineManager.isOnline();
};

// What the browser says about the connection, which Query follows
const useOnline = (): boolean => {
    return useSyncExternalStore(subscribe, isOnline);
};

export { useOnline };
