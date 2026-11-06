import { describe, expect, it } from 'vitest';

import { shuffled } from './shuffle';

const ITEMS = ['a', 'b', 'c', 'd'];

describe('shuffled', () => {
    it('keeps every item, once, and leaves the original alone', () => {
        const original = [...ITEMS];

        for (let seed = 0; seed < 200; seed++) {
            const order = shuffled(original, seed);

            expect(order.toSorted(), `seed ${seed}`).toEqual(ITEMS);
            expect(original).toEqual(ITEMS);
        }
    });

    it('gives the same order for the same seed', () => {
        for (let seed = 0; seed < 200; seed++) {
            expect(shuffled(ITEMS, seed), `seed ${seed}`).toEqual(shuffled(ITEMS, seed));
        }
    });

    it('reaches more than one order', () => {
        const orders = new Set(Array.from({ length: 200 }, (_, seed) => shuffled(ITEMS, seed).join()));

        expect(orders.size).toBeGreaterThan(10);
    });

    it('puts each item first about as often as any other, and in any place', () => {
        const runs = 4000;
        const first = new Map<string, number>();
        const places = new Map<string, Set<number>>();

        for (let seed = 0; seed < runs; seed++) {
            const order = shuffled(ITEMS, seed);
            first.set(order[0]!, (first.get(order[0]!) ?? 0) + 1);
            for (const [place, item] of order.entries()) {
                places.set(item, (places.get(item) ?? new Set()).add(place));
            }
        }

        for (const item of ITEMS) {
            expect(first.get(item) ?? 0, item).toBeGreaterThan(runs / ITEMS.length - 200);
            expect(first.get(item) ?? 0, item).toBeLessThan(runs / ITEMS.length + 200);
            expect(places.get(item)?.size, item).toBe(ITEMS.length);
        }
    });

    it('takes any whole number as a seed, the 32 bits of it', () => {
        expect(shuffled(ITEMS, 2 ** 32 + 5)).toEqual(shuffled(ITEMS, 5));
        expect(shuffled(ITEMS, 0xffffffff)).toHaveLength(ITEMS.length);
        expect(shuffled(ITEMS, -1)).toEqual(shuffled(ITEMS, 0xffffffff));
    });

    it('is empty for nothing and the same for one item', () => {
        expect(shuffled([], 7)).toEqual([]);
        expect(shuffled(['only'], 7)).toEqual(['only']);
    });
});
