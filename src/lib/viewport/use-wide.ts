import { useSyncExternalStore } from 'react';

// From here up the header holds the destinations; below it they are a bar at the bottom
const WIDE_QUERY = '(width >= 40rem)';

const canMatch = () => typeof window.matchMedia === 'function';

const subscribe = (onChange: () => void) => {
    if (!canMatch()) return () => undefined;
    const query = window.matchMedia(WIDE_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
};

const getSnapshot = () => {
    return canMatch() ? window.matchMedia(WIDE_QUERY).matches : true;
};

const getServerSnapshot = () => true;

const useWide = () => {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

export { useWide, WIDE_QUERY };
