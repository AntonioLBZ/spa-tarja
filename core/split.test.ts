import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { MAX_AMOUNT_CENTS } from './money';
import { sharedEntryInputSchema, type Share } from './shared-entry';
import {
    HUNDRED_PERCENT,
    equalPercents,
    percentLeft,
    percentsOf,
    splitByPercent,
    splitEqually,
    splitExactly,
    unassignedCents,
    type MemberPercent,
} from './split';
import { memberIdOf, seededRandom, type Random } from './test/random';

const CASES = 2000;

const BAD_AMOUNTS = [
    ['a negative amount', -100],
    ['a fraction of a cent', 1000.5],
    ['an amount over the maximum', MAX_AMOUNT_CENTS + 1],
    ['an amount past the safe integers', Number.MAX_SAFE_INTEGER + 1],
    ['not a number', Number.NaN],
] as const;

function sumOf(shares: readonly { cents: number }[]): number {
    return shares.reduce((sum, share) => sum + share.cents, 0);
}

function randomAmount(random: Random): number {
    return random.pick([random.int(1, 20), random.int(1, 100_000), random.int(1, MAX_AMOUNT_CENTS)]);
}

function randomMembersIn(random: Random): string[] {
    const ids = Array.from({ length: random.int(1, 30) }, (_, index) => memberIdOf(index));
    const chosen = ids.filter(() => random.chance(0.7));
    return chosen.length > 0 ? chosen : [random.pick(ids)];
}

function randomPercents(random: Random, memberIds: readonly string[]): MemberPercent[] {
    const basisPoints = random.parts(HUNDRED_PERCENT, memberIds.length);
    return memberIds.map((memberId, index) => ({ memberId, basisPoints: basisPoints[index]! }));
}

function randomParts(random: Random, amountCents: number, memberIds: readonly string[]): Share[] {
    const cents = random.parts(amountCents, memberIds.length);
    return memberIds.map((memberId, index) => ({ memberId, cents: cents[index]! }));
}

function isEntry(amountCents: number, shares: readonly Share[]): boolean {
    return v.is(sharedEntryInputSchema, {
        kind: 'expense',
        text: '',
        categoryId: 'food',
        amountCents,
        currency: 'EUR',
        date: '2026-10-25',
        paidBy: memberIdOf(0),
        split: 'equal',
        shares,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
    });
}

function expectValidShares(amountCents: number, shares: readonly Share[], memberIds: readonly string[], seed: number) {
    const ids = shares.map((share) => share.memberId);

    expect(sumOf(shares), `seed ${seed}`).toBe(amountCents);
    expect(
        shares.every((share) => Number.isInteger(share.cents) && share.cents >= 1),
        `seed ${seed}`
    ).toBe(true);
    expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
    expect(ids, `seed ${seed}`).toEqual(memberIds.filter((id) => ids.includes(id)));
    expect(isEntry(amountCents, shares), `seed ${seed}`).toBe(true);
}

const SEEDS = 3000;

function seedOf(random: Random): number {
    return random.int(0, 0xffffffff);
}

function centsOf(shares: readonly Share[] | null, memberIds: readonly string[]): number[] {
    return memberIds.map((id) => shares?.find((share) => share.memberId === id)?.cents ?? 0);
}

describe('splitEqually', () => {
    it('gives each member the amount divided, one of them the cents left, whom the seed picks', () => {
        const members = ['ana', 'bruno', 'carla'];

        for (let seed = 0; seed < 200; seed++) {
            const shares = splitEqually(1000, members, seed);

            expect(
                shares?.map((share) => share.memberId),
                `seed ${seed}`
            ).toEqual(members);
            expect(centsOf(shares, members).toSorted(), `seed ${seed}`).toEqual([333, 333, 334]);
        }
        for (let seed = 0; seed < 200; seed++) {
            const shares = splitEqually(1001, members, seed);

            expect(centsOf(shares, members).toSorted(), `seed ${seed}`).toEqual([333, 334, 334]);
        }
    });

    it('gives the same split for the same seed', () => {
        const members = ['ana', 'bruno', 'carla'];

        for (let seed = 0; seed < 200; seed++) {
            expect(splitEqually(1000, members, seed), `seed ${seed}`).toEqual(splitEqually(1000, members, seed));
        }
    });

    it('gives the cent left to every member in turn, about as often to each', () => {
        const members = ['ana', 'bruno', 'carla'];
        const extras = new Map<string, number>();

        for (let seed = 0; seed < SEEDS; seed++) {
            const shares = splitEqually(1000, members, seed) ?? [];
            const lucky = shares.find((share) => share.cents === 334)!;
            extras.set(lucky.memberId, (extras.get(lucky.memberId) ?? 0) + 1);
        }

        for (const member of members) {
            expect(extras.get(member) ?? 0, member).toBeGreaterThan(SEEDS / 3 - 150);
            expect(extras.get(member) ?? 0, member).toBeLessThan(SEEDS / 3 + 150);
        }
    });

    it('gives two cents left to two different members, any two about as often as any other', () => {
        const members = ['ana', 'bruno', 'carla', 'dani', 'eva'];
        const pairs = new Map<string, number>();
        const extras = new Map<string, number>();

        for (let seed = 0; seed < SEEDS; seed++) {
            const cents = centsOf(splitEqually(1002, members, seed), members);
            const lucky = members.filter((_, index) => cents[index] === 201);

            expect(cents.toSorted(), `seed ${seed}`).toEqual([200, 200, 200, 201, 201]);
            pairs.set(lucky.join(), (pairs.get(lucky.join()) ?? 0) + 1);
            for (const member of lucky) extras.set(member, (extras.get(member) ?? 0) + 1);
        }

        expect(pairs.size).toBe(10);
        for (const member of members) {
            expect(extras.get(member) ?? 0, member).toBeGreaterThan((SEEDS * 2) / 5 - 150);
            expect(extras.get(member) ?? 0, member).toBeLessThan((SEEDS * 2) / 5 + 150);
        }
        for (const [pair, count] of pairs) {
            expect(count, pair).toBeGreaterThan(SEEDS / 10 - 100);
            expect(count, pair).toBeLessThan(SEEDS / 10 + 100);
        }
    });

    it('shows no luck when the amount divides: everybody gets the same whatever the seed', () => {
        const members = ['ana', 'bruno', 'carla'];

        for (let seed = 0; seed < 200; seed++) {
            expect(splitEqually(1200, members, seed), `seed ${seed}`).toEqual([
                { memberId: 'ana', cents: 400 },
                { memberId: 'bruno', cents: 400 },
                { memberId: 'carla', cents: 400 },
            ]);
        }
    });

    it('splits among the members who are in only', () => {
        expect(splitEqually(3000, ['bruno'], 1)).toEqual([{ memberId: 'bruno', cents: 3000 }]);
    });

    it('leaves out a member whose part comes to nothing, one of them each time the seed picks', () => {
        const members = ['ana', 'bruno', 'carla'];
        const out = new Set<string>();

        for (let seed = 0; seed < 200; seed++) {
            const shares = splitEqually(2, members, seed) ?? [];

            expect(shares, `seed ${seed}`).toHaveLength(2);
            expect(
                shares.map((share) => share.cents),
                `seed ${seed}`
            ).toEqual([1, 1]);
            out.add(members.find((member) => !shares.some((share) => share.memberId === member))!);
        }

        expect(out.size).toBe(3);
    });

    it('is none when nobody is in', () => {
        expect(splitEqually(1000, [], 1)).toBeNull();
    });

    it.each(BAD_AMOUNTS)('is none for %s', (_name, amountCents) => {
        expect(splitEqually(amountCents, ['ana', 'bruno'], 1)).toBeNull();
    });

    it('adds up to the amount, each part the amount over the members rounded down or up, in the group order', () => {
        for (let seed = 1; seed <= CASES; seed++) {
            const random = seededRandom(seed);
            const memberIds = randomMembersIn(random);
            const amountCents = randomAmount(random);
            const splitSeed = seedOf(random);

            const shares = splitEqually(amountCents, memberIds, splitSeed);

            expect(shares, `seed ${seed}`).not.toBeNull();
            expectValidShares(amountCents, shares ?? [], memberIds, seed);
            const cents = centsOf(shares, memberIds);
            const floor = Math.floor(amountCents / memberIds.length);
            for (const part of cents) expect([floor, floor + 1], `seed ${seed}`).toContain(part);
            expect(splitEqually(amountCents, memberIds, splitSeed), `seed ${seed}`).toEqual(shares);
        }
    });
});

describe('splitByPercent', () => {
    it('rounds each part down and gives the cents left to the biggest fractions', () => {
        expect(
            splitByPercent(
                1000,
                [
                    { memberId: 'ana', basisPoints: 3333 },
                    { memberId: 'bruno', basisPoints: 3333 },
                    { memberId: 'carla', basisPoints: 3334 },
                ],
                1
            )
        ).toEqual([
            { memberId: 'ana', cents: 333 },
            { memberId: 'bruno', cents: 333 },
            { memberId: 'carla', cents: 334 },
        ]);
    });

    it('gives a cent left to the member the seed puts first when two fractions tie, the bigger fraction first', () => {
        const percents = [
            { memberId: 'ana', basisPoints: 3334 },
            { memberId: 'bruno', basisPoints: 3333 },
            { memberId: 'carla', basisPoints: 3333 },
        ];
        const lucky = new Set<string>();

        for (let seed = 0; seed < 200; seed++) {
            const shares = splitByPercent(200, percents, seed) ?? [];

            expect(centsOf(shares, ['ana', 'bruno', 'carla']).toSorted(), `seed ${seed}`).toEqual([66, 67, 67]);
            expect(shares.find((share) => share.memberId === 'ana')?.cents, `seed ${seed}`).toBe(67);
            lucky.add(shares.find((share) => share.memberId !== 'ana' && share.cents === 67)!.memberId);
        }

        expect([...lucky].toSorted()).toEqual(['bruno', 'carla']);
    });

    it('gives the same split for the same seed', () => {
        const percents = [
            { memberId: 'ana', basisPoints: 3333 },
            { memberId: 'bruno', basisPoints: 3333 },
            { memberId: 'carla', basisPoints: 3334 },
        ];

        for (let seed = 0; seed < 200; seed++) {
            expect(splitByPercent(200, percents, seed), `seed ${seed}`).toEqual(splitByPercent(200, percents, seed));
        }
    });

    it('leaves out a member at 0 %', () => {
        expect(
            splitByPercent(
                5000,
                [
                    { memberId: 'ana', basisPoints: 7550 },
                    { memberId: 'bruno', basisPoints: 0 },
                    { memberId: 'carla', basisPoints: 2450 },
                ],
                1
            )
        ).toEqual([
            { memberId: 'ana', cents: 3775 },
            { memberId: 'carla', cents: 1225 },
        ]);
    });

    it('leaves out a member whose part comes to nothing, the one the seed picks when they tie', () => {
        const percents = [
            { memberId: 'ana', basisPoints: 5000 },
            { memberId: 'bruno', basisPoints: 5000 },
        ];
        const paid = new Set<string>();

        for (let seed = 0; seed < 200; seed++) {
            const shares = splitByPercent(1, percents, seed) ?? [];

            expect(shares, `seed ${seed}`).toHaveLength(1);
            expect(shares[0]?.cents, `seed ${seed}`).toBe(1);
            paid.add(shares[0]!.memberId);
        }

        expect([...paid].toSorted()).toEqual(['ana', 'bruno']);
    });

    it.each([
        ['add up to less than 100 %', [9999, 0]],
        ['add up to more than 100 %', [5000, 5001]],
        ['hold a negative one', [10_100, -100]],
        ['hold one over 100 %', [10_001, -1]],
        ['hold more than two decimals', [3333.5, 6666.5]],
        ['are none', []],
    ])('is none for percentages that %s', (_name, basisPoints) => {
        const percents = basisPoints.map((points, index) => ({ memberId: memberIdOf(index), basisPoints: points }));

        expect(splitByPercent(1000, percents, 1)).toBeNull();
    });

    it.each(BAD_AMOUNTS)('is none for %s', (_name, amountCents) => {
        const halves = [
            { memberId: 'ana', basisPoints: 5000 },
            { memberId: 'bruno', basisPoints: 5000 },
        ];

        expect(splitByPercent(amountCents, halves, 1)).toBeNull();
    });

    it('adds up to the amount, each part within a cent of its exact percentage', () => {
        for (let seed = 1; seed <= CASES; seed++) {
            const random = seededRandom(seed);
            const memberIds = randomMembersIn(random);
            const amountCents = randomAmount(random);
            const percents = randomPercents(random, memberIds);
            const splitSeed = seedOf(random);

            const shares = splitByPercent(amountCents, percents, splitSeed);

            expect(shares, `seed ${seed}`).not.toBeNull();
            expectValidShares(amountCents, shares ?? [], memberIds, seed);
            for (const { memberId, basisPoints } of percents) {
                const cents = shares?.find((share) => share.memberId === memberId)?.cents ?? 0;
                const exact = (amountCents * basisPoints) / HUNDRED_PERCENT;
                expect(Math.abs(cents - exact), `seed ${seed}`).toBeLessThan(1);
                if (basisPoints === 0) expect(cents, `seed ${seed}`).toBe(0);
            }
            expect(splitByPercent(amountCents, percents, splitSeed), `seed ${seed}`).toEqual(shares);
        }
    });
});

describe('splitExactly', () => {
    it('keeps the amounts as they were typed, leaving out a member at nothing', () => {
        expect(
            splitExactly(1000, [
                { memberId: 'ana', cents: 600 },
                { memberId: 'bruno', cents: 0 },
                { memberId: 'carla', cents: 400 },
            ])
        ).toEqual([
            { memberId: 'ana', cents: 600 },
            { memberId: 'carla', cents: 400 },
        ]);
    });

    it.each([
        ['leave some unassigned', [600, 300]],
        ['go over the amount', [600, 401]],
        ['hold a negative one', [1100, -100]],
        ['hold a fraction of a cent', [600.5, 399.5]],
        ['are none', []],
    ])('is none for amounts that %s', (_name, cents) => {
        const parts = cents.map((part, index) => ({ memberId: memberIdOf(index), cents: part }));

        expect(splitExactly(1000, parts)).toBeNull();
    });

    it.each(BAD_AMOUNTS)('is none for %s, even when a part is all of it', (_name, amountCents) => {
        expect(splitExactly(amountCents, [{ memberId: 'ana', cents: amountCents }])).toBeNull();
    });

    it('adds up to the amount and keeps every part that is something', () => {
        for (let seed = 1; seed <= CASES; seed++) {
            const random = seededRandom(seed);
            const memberIds = randomMembersIn(random);
            const amountCents = randomAmount(random);
            const parts = randomParts(random, amountCents, memberIds);

            const shares = splitExactly(amountCents, parts);

            expect(shares, `seed ${seed}`).toEqual(parts.filter((part) => part.cents > 0));
            expectValidShares(amountCents, shares ?? [], memberIds, seed);
        }
    });
});

describe('unassignedCents', () => {
    it('is what is left of the amount once the parts are taken out', () => {
        expect(unassignedCents(1000, [{ memberId: 'ana', cents: 600 }])).toBe(400);
        expect(
            unassignedCents(1000, [
                { memberId: 'ana', cents: 600 },
                { memberId: 'bruno', cents: 400 },
            ])
        ).toBe(0);
    });

    it('is negative when the parts go over the amount', () => {
        expect(
            unassignedCents(1000, [
                { memberId: 'ana', cents: 600 },
                { memberId: 'bruno', cents: 550 },
            ])
        ).toBe(-150);
    });
});

describe('percentLeft', () => {
    it('is what is left to reach 100 %, negative when the percentages go over it', () => {
        expect(percentLeft([{ memberId: 'ana', basisPoints: 7500 }])).toBe(2500);
        expect(
            percentLeft([
                { memberId: 'ana', basisPoints: 7500 },
                { memberId: 'bruno', basisPoints: 2500 },
            ])
        ).toBe(0);
        expect(
            percentLeft([
                { memberId: 'ana', basisPoints: 7500 },
                { memberId: 'bruno', basisPoints: 2750 },
            ])
        ).toBe(-250);
    });
});

describe('equalPercents', () => {
    it('splits 100 % evenly in hundredths, the remainder to members the seed picks', () => {
        const members = ['ana', 'bruno', 'carla'];
        const lucky = new Set<string>();

        for (let seed = 0; seed < 200; seed++) {
            const percents = equalPercents(members, seed);

            expect(
                percents.map((percent) => percent.memberId),
                `seed ${seed}`
            ).toEqual(members);
            expect(percents.map((percent) => percent.basisPoints).toSorted(), `seed ${seed}`).toEqual([
                3333, 3333, 3334,
            ]);
            lucky.add(percents.find((percent) => percent.basisPoints === 3334)!.memberId);
            expect(equalPercents(members, seed), `seed ${seed}`).toEqual(percents);
        }

        expect([...lucky].toSorted()).toEqual(members);
    });

    it('adds up to 100 % for any number of members', () => {
        for (let count = 1; count <= 30; count++) {
            const memberIds = Array.from({ length: count }, (_, index) => memberIdOf(index));

            expect(percentLeft(equalPercents(memberIds, count * 31)), `${count} members`).toBe(0);
        }
    });

    it('starts the percent mode with the shares of the equal split, up to 100.00 in the amount', () => {
        for (let seed = 1; seed <= CASES; seed++) {
            const random = seededRandom(seed);
            const memberIds = randomMembersIn(random);
            const amountCents = random.int(1, 10_000);
            const splitSeed = seedOf(random);

            expect(splitByPercent(amountCents, equalPercents(memberIds, splitSeed), splitSeed), `seed ${seed}`).toEqual(
                splitEqually(amountCents, memberIds, splitSeed)
            );
        }
    });
});

describe('percentsOf', () => {
    it('is each share over the amount, to two decimals', () => {
        expect(
            percentsOf(1000, [
                { memberId: 'ana', cents: 334 },
                { memberId: 'bruno', cents: 333 },
                { memberId: 'carla', cents: 333 },
            ])
        ).toEqual([
            { memberId: 'ana', basisPoints: 3340 },
            { memberId: 'bruno', basisPoints: 3330 },
            { memberId: 'carla', basisPoints: 3330 },
        ]);
    });

    it('rounds as the parts are, so the percentages add up to 100 %', () => {
        expect(
            percentsOf(3, [
                { memberId: 'ana', cents: 1 },
                { memberId: 'bruno', cents: 1 },
                { memberId: 'carla', cents: 1 },
            ])
        ).toEqual([
            { memberId: 'ana', basisPoints: 3334 },
            { memberId: 'bruno', basisPoints: 3333 },
            { memberId: 'carla', basisPoints: 3333 },
        ]);
    });

    it('adds up to 100 %, each within a hundredth of its ratio, and splits back to within 0.01 % of the amount', () => {
        for (let seed = 1; seed <= CASES; seed++) {
            const random = seededRandom(seed);
            const memberIds = randomMembersIn(random);
            const amountCents = randomAmount(random);
            const shares = splitExactly(amountCents, randomParts(random, amountCents, memberIds)) ?? [];

            const percents = percentsOf(amountCents, shares);

            expect(percentLeft(percents), `seed ${seed}`).toBe(0);
            for (const [index, share] of shares.entries()) {
                const exact = (share.cents * HUNDRED_PERCENT) / amountCents;
                expect(Math.abs(percents[index]!.basisPoints - exact), `seed ${seed}`).toBeLessThan(1);
            }
            const again = splitByPercent(amountCents, percents, seed) ?? [];
            for (const share of shares) {
                const cents = again.find((other) => other.memberId === share.memberId)?.cents ?? 0;
                expect(Math.abs(cents - share.cents), `seed ${seed}`).toBeLessThanOrEqual(
                    Math.ceil(amountCents / HUNDRED_PERCENT)
                );
            }
        }
    });
});
