import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { createPersister } from './persister';
import { idbStorage } from './storage';

describe('idbStorage', () => {
    it('keeps what is set, structured values included', async () => {
        await idbStorage.set('k', { list: [1, 2, { nested: true }] });

        expect(await idbStorage.get('k')).toEqual({ list: [1, 2, { nested: true }] });
    });

    it('answers undefined for a key nobody set', async () => {
        expect(await idbStorage.get('missing')).toBeUndefined();
    });

    it('forgets a removed key', async () => {
        await idbStorage.set('gone', 1);

        await idbStorage.remove('gone');

        expect(await idbStorage.get('gone')).toBeUndefined();
    });
});

describe('createPersister', () => {
    it('restores the client it persisted, and nothing after removing it', async () => {
        const persister = createPersister(idbStorage);
        const client = { timestamp: 1, buster: 'x', clientState: { mutations: [], queries: [] } };

        await persister.persistClient(client);
        expect(await persister.restoreClient()).toEqual(client);

        await persister.removeClient();
        expect(await persister.restoreClient()).toBeUndefined();
    });
});
