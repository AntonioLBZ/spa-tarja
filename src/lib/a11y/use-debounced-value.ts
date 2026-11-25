import { useEffect, useState } from 'react';

// How long what is spoken waits for the typing to stop, so a screen reader doesn't read every key
const SPOKEN_DELAY_MS = 500;

// The value once it has held still for the delay: what changes on every key reaches a live region only when the typing
// pauses
const useDebouncedValue = <T>(value: T, delay: number = SPOKEN_DELAY_MS): T => {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return settled;
};

export { SPOKEN_DELAY_MS, useDebouncedValue };
