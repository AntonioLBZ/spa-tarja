import { describe, expect, it } from 'vitest';

import { sampleGroup } from '@/lib/test/groups';

import { pinnedGroups } from './pinned-groups';

describe('pinnedGroups', () => {
    it('keeps the open groups the person pinned, in the order they were pinned', () => {
        const later = sampleGroup({ name: 'Later', pinnedAt: 2_000 });
        const first = sampleGroup({ name: 'First', pinnedAt: 1_000 });
        const unpinned = sampleGroup({ name: 'Unpinned' });

        expect(pinnedGroups([later, unpinned, first])).toEqual([first, later]);
    });

    it('leaves out a pinned group that is closed for the person', () => {
        const closed = sampleGroup({ closed: 'left', pinnedAt: 1_000 });

        expect(pinnedGroups([closed])).toEqual([]);
    });
});
