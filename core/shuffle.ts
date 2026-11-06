// The next number, from 0 up to but not including 1, of Mulberry32: a small generator that a 32-bit seed sets going
const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
    };
};

// The items in an order the seed sets (Fisher-Yates): the same seed always gives the same order, and any item is as
// likely as any other to come first
const shuffled = <T>(items: readonly T[], seed: number): T[] => {
    const next = mulberry32(seed);
    const order = [...items];

    for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(next() * (index + 1));
        [order[index], order[other]] = [order[other]!, order[index]!];
    }

    return order;
};

export { shuffled };
