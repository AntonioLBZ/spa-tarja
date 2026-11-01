import { describe, expect, it } from 'vitest';

import { memberBalances, type MemberBalance } from './balance';
import { simplifyDebts } from './simplify';
import { seededRandom } from './test/random';
import { mergeMember, randomGroup } from './test/random-group';

const GROUPS = 1000;

function balances(cents: Record<string, number>): MemberBalance[] {
    return Object.entries(cents).map(([memberId, balance]) => ({ memberId, cents: balance }));
}

describe('simplifyDebts', () => {
    it('has the member who owes most pay the one owed most the smaller amount, until all are settled', () => {
        expect(simplifyDebts(balances({ ana: 3000, bruno: 1000, carla: -2500, dani: -1500 }))).toEqual([
            { from: 'carla', to: 'ana', cents: 2500 },
            { from: 'dani', to: 'bruno', cents: 1000 },
            { from: 'dani', to: 'ana', cents: 500 },
        ]);
    });

    it('may name two members who shared nothing', () => {
        expect(simplifyDebts(balances({ ana: -1000, bruno: 0, carla: 1000 }))).toEqual([
            { from: 'ana', to: 'carla', cents: 1000 },
        ]);
    });

    it('gives a tie to the first in the group order', () => {
        expect(simplifyDebts(balances({ ana: -1000, bruno: -1000, carla: 2000 }))).toEqual([
            { from: 'ana', to: 'carla', cents: 1000 },
            { from: 'bruno', to: 'carla', cents: 1000 },
        ]);
        expect(simplifyDebts(balances({ ana: 1000, bruno: 1000, carla: -2000 }))).toEqual([
            { from: 'carla', to: 'ana', cents: 1000 },
            { from: 'carla', to: 'bruno', cents: 1000 },
        ]);
    });

    it('has nothing to pay in a group that is settled', () => {
        expect(simplifyDebts(balances({ ana: 0, bruno: 0 }))).toEqual([]);
        expect(simplifyDebts([])).toEqual([]);
    });

    it('settles every balance, nobody both paying and receiving, in fewer payments than members with a balance', () => {
        for (let seed = 1; seed <= GROUPS; seed++) {
            const random = seededRandom(seed);
            const { members, entries } = randomGroup(random);
            const merged = random.chance(0.3)
                ? mergeMember(members, random.pick(members.slice(1)).id, members[0]!.id)
                : members;
            const before = memberBalances(entries, merged);

            const payments = simplifyDebts(before);

            const left = new Map(before.map(({ memberId, cents }) => [memberId, cents]));
            for (const { from, to, cents } of payments) {
                left.set(from, (left.get(from) ?? 0) + cents);
                left.set(to, (left.get(to) ?? 0) - cents);
            }
            expect(
                [...left.values()].every((cents) => cents === 0),
                `seed ${seed}`
            ).toBe(true);
            const payers = new Set(payments.map((payment) => payment.from));
            expect(
                payments.some((payment) => payers.has(payment.to)),
                `seed ${seed}`
            ).toBe(false);
            expect(
                payments.every((payment) => payment.cents > 0),
                `seed ${seed}`
            ).toBe(true);
            const withBalance = before.filter((balance) => balance.cents !== 0).length;
            expect(payments.length, `seed ${seed}`).toBeLessThanOrEqual(Math.max(withBalance - 1, 0));
            expect(simplifyDebts(before), `seed ${seed}`).toEqual(payments);
        }
    });
});
