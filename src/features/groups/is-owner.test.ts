import { describe, expect, it } from 'vitest';

import { person, sampleGroup } from '@/lib/test/groups';

import { isOwner } from './is-owner';

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');

describe('isOwner', () => {
    it('is the owner of a group', () => {
        expect(isOwner(sampleGroup({ members: [ana, bea], me: ana.id }))).toBe(true);
    });

    it('is not any other member of a group', () => {
        expect(isOwner(sampleGroup({ members: [ana, bea], me: bea.id }))).toBe(false);
    });

    it('is either side of a friend, who has nothing to hand over', () => {
        expect(isOwner(sampleGroup({ kind: 'direct', name: null, members: [ana, bea], me: bea.id }))).toBe(true);
    });
});
