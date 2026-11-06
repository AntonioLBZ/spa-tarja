import { describe, expect, it } from 'vitest';

import { person, sampleEntry, sampleGroup } from '@/lib/test/groups';

import { mayDelete } from './may-delete';

import type { GroupMember } from '@core/shared-group';

const ana = person('Ana', { role: 'owner' });

function owing(other: GroupMember) {
    const group = sampleGroup({ members: [ana, other], me: ana.id });
    const dinner = sampleEntry(group, {
        amountCents: 2000,
        shares: [
            { memberId: ana.id, cents: 1000 },
            { memberId: other.id, cents: 1000 },
        ],
    });
    return { group, entries: [dinner] };
}

describe('mayDelete', () => {
    it('allows a group where every balance is zero', () => {
        const group = sampleGroup({ members: [ana, person('Bea')], me: ana.id });

        expect(mayDelete(group, [])).toBe(true);
    });

    it('refuses a group with a balance and another user still in it', () => {
        const { group, entries } = owing(person('Bea'));

        expect(mayDelete(group, entries)).toBe(false);
    });

    it.each([
        ['a placeholder', person('Bea', { claimed: false })],
        ['a user who left', person('Bea', { leftAt: 1 })],
        ['a user who deleted their account', person('')],
    ])('allows a group with a balance when the only other one is %s', (_, other) => {
        const { group, entries } = owing(other);

        expect(mayDelete(group, entries)).toBe(true);
    });

    it('counts no deleted entry', () => {
        const { group, entries } = owing(person('Bea'));

        expect(mayDelete(group, [{ ...entries[0]!, deletedAt: 2 }])).toBe(true);
    });
});
