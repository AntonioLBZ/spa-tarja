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
