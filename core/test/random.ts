// Numbers that look random but come from a seed, so a property test gives the same cases on every run and a failing
// one can be told by its seed
interface Random {
    // An integer from min to max, both included
    int: (min: number, max: number) => number;
    pick: <T>(items: readonly T[]) => T;
    chance: (probability: number) => boolean;
    // Integers of at least zero that add up to the whole
    parts: (whole: number, count: number) => number[];
}

// Mulberry32: small, fast and good enough to vary test cases
const seededRandom = (seed: number): Random => {
    let state = seed >>> 0;

    const next = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
    };

    const int = (min: number, max: number): number => {
        return min + Math.floor(next() * (max - min + 1));
    };

    const parts = (whole: number, count: number): number[] => {
        const cuts = Array.from({ length: count - 1 }, () => int(0, whole)).sort((a, b) => a - b);
        return [...cuts, whole].map((cut, index) => cut - (index === 0 ? 0 : cuts[index - 1]!));
    };

    return {
        int,
        pick: (items) => items[int(0, items.length - 1)]!,
        chance: (probability) => next() < probability,
        parts,
    };
};

// A member id of the shape the schemas take, the same for the same number
const memberIdOf = (index: number): string => {
    return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
};

export { memberIdOf, seededRandom, type Random };
