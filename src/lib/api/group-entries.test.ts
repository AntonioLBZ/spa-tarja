import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { stubApi } from '@/lib/test/render-app';

import { fetchEntryChanges, putEntry } from './group-entries';

const group = sampleGroup();
const other = sampleGroup();

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('fetchEntryChanges', () => {
    it("pages through one group's changes after its own cursor", async () => {
        const [first, second] = [sampleEntry(group), sampleEntry(group)];
        const api = createFakeApi({ groups: [group, other], entries: [first, sampleEntry(other), second] });
        stubApi(api.handler);

        const page = await fetchEntryChanges(group.id, 1);

        expect(page.entries.map((entry) => entry.id)).toEqual([second.id]);
        expect(page.cursor).toBe(2);
        expect(page.hasMore).toBe(false);
        expect(api.requests).toEqual([`GET /api/groups/${group.id}/entries?after=1`]);
    });
});

describe('putEntry', () => {
    it('sends the entry under its id and answers it with who wrote it', async () => {
        const api = createFakeApi({ groups: [group] });
        stubApi(api.handler);
        const entry = sampleEntry(group);

        const kept = await putEntry(entry);

        expect(kept).toEqual(api.entriesOf(group.id)[0]);
        expect(kept).toMatchObject({ id: entry.id, text: entry.text, createdBy: group.me, updatedBy: group.me });
        expect(api.requests).toEqual([`PUT /api/groups/${group.id}/entries/${entry.id}`]);
    });

    it('throws the reason the server gives', async () => {
        const api = createFakeApi({ groups: [{ ...group, closed: 'deleted' }] });
        stubApi(api.handler);

        await expect(putEntry(sampleEntry(group))).rejects.toMatchObject({ status: 409, code: 'closed' });
    });
});
