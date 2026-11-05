import { useCallback, useEffect, useRef, useState } from 'react';

import { readDuration } from './motion';

// What was deleted a moment ago, kept on screen by its id until its fade-out is over; nothing is kept when reduced
// motion has zeroed the durations
const useFadeOut = <T extends { id: string }>() => {
    const [leaving, setLeaving] = useState<ReadonlyMap<string, T>>(new Map());
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach(clearTimeout);
    }, []);

    const fadeOut = useCallback((deleted: readonly T[]) => {
        const duration = readDuration('--duration-base');
        if (duration === 0) return;
        setLeaving((current) => new Map([...current, ...deleted.map((item) => [item.id, item] as const)]));
        const timer = setTimeout(() => {
            timers.current.delete(timer);
            setLeaving((current) => {
                const next = new Map(current);
                for (const item of deleted) next.delete(item.id);
                return next;
            });
        }, duration);
        timers.current.add(timer);
    }, []);

    return { leaving, fadeOut };
};

export { useFadeOut };
