import { describe, expect, it } from 'vitest';

import { canonicalMember } from './shared-member';

const members = [
    { id: 'ana', mergedInto: null },
    { id: 'bruno', mergedInto: null },
    { id: 'dummy', mergedInto: 'bruno' },
    { id: 'carla', mergedInto: null },
];

describe('canonicalMember', () => {
    it('reads a placeholder that was merged as the member it was merged into', () => {
        expect(canonicalMember(members, 'dummy')).toBe('bruno');
    });

    it('reads a member that was never merged as itself', () => {
        expect(canonicalMember(members, 'ana')).toBe('ana');
        expect(canonicalMember(members, 'bruno')).toBe('bruno');
    });

    it('reads an id the members do not hold as itself', () => {
        expect(canonicalMember(members, 'eve')).toBe('eve');
        expect(canonicalMember([], 'ana')).toBe('ana');
    });
});

describe('canonicalMember on merges the server never makes', () => {
    it('follows a chain of merges to its end', () => {
        const chain = [
            { id: 'first', mergedInto: 'second' },
            { id: 'second', mergedInto: 'carla' },
            { id: 'carla', mergedInto: null },
        ];

        expect(chain.map((member) => canonicalMember(chain, member.id))).toEqual(['carla', 'carla', 'carla']);
    });

    it('follows a long chain to its end', () => {
        const chain = Array.from({ length: 50 }, (_, index) => ({
            id: `m${index}`,
            mergedInto: index < 49 ? `m${index + 1}` : null,
        }));

        expect(new Set(chain.map((member) => canonicalMember(chain, member.id)))).toEqual(new Set(['m49']));
    });

    it('ends a chain on an id the members do not hold', () => {
        expect(canonicalMember([{ id: 'dummy', mergedInto: 'eve' }], 'dummy')).toBe('eve');
    });

    it('reads a member merged into itself as itself', () => {
        expect(canonicalMember([{ id: 'ana', mergedInto: 'ana' }], 'ana')).toBe('ana');
    });

    it('reads every member of a loop, and every chain into it, as the one of the loop that comes first in the group', () => {
        const loop = [
            { id: 'dani', mergedInto: 'bruno' },
            { id: 'ana', mergedInto: 'bruno' },
            { id: 'bruno', mergedInto: 'carla' },
            { id: 'carla', mergedInto: 'ana' },
        ];

        expect(loop.map((member) => canonicalMember(loop, member.id))).toEqual(['ana', 'ana', 'ana', 'ana']);
        expect(canonicalMember(loop.toReversed(), 'ana')).toBe('carla');
    });
});
