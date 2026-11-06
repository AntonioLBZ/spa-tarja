import { describe, expect, it } from 'vitest';

import { createMemoryStorage } from '@/lib/test/memory-storage';

import { readSharedWith, rememberSharedWith } from './shared-with';
import { createUserStorage } from './user-storage';

describe('user storage', () => {
    it('keeps what it is given under the user, apart from anyone else', async () => {
        const storage = createMemoryStorage();
        const ana = createUserStorage(storage, 'ana');
        const bea = createUserStorage(storage, 'bea');

        await ana.storage.set('tarja:outbox', ['ana']);

        expect(await ana.storage.get('tarja:outbox')).toEqual(['ana']);
        expect(await bea.storage.get('tarja:outbox')).toBeUndefined();
        expect(await storage.get('tarja:outbox')).toBeUndefined();
        expect(await storage.get('tarja:outbox:ana')).toEqual(['ana']);
    });

    it('removes a key for that user only', async () => {
        const storage = createMemoryStorage();
        const ana = createUserStorage(storage, 'ana');
        const bea = createUserStorage(storage, 'bea');
        await ana.storage.set('tarja:outbox', ['ana']);
        await bea.storage.set('tarja:outbox', ['bea']);

        await ana.storage.remove('tarja:outbox');

        expect(await ana.storage.get('tarja:outbox')).toBeUndefined();
        expect(await bea.storage.get('tarja:outbox')).toEqual(['bea']);
    });

    describe('discard', () => {
        it("deletes both outboxes and the cache of the user, and nobody else's", async () => {
            const storage = createMemoryStorage();
            const ana = createUserStorage(storage, 'ana');
            const bea = createUserStorage(storage, 'bea');
            await ana.storage.set('tarja:outbox', ['ana']);
            await ana.storage.set('tarja:group-outbox', ['ana in a group']);
            await ana.storage.set('tarja:query-cache', { ana: true });
            await bea.storage.set('tarja:outbox', ['bea']);
            await bea.storage.set('tarja:group-outbox', ['bea in a group']);
            await bea.storage.set('tarja:query-cache', { bea: true });

            await ana.discard();

            expect(await ana.storage.get('tarja:outbox')).toBeUndefined();
            expect(await ana.storage.get('tarja:group-outbox')).toBeUndefined();
            expect(await ana.storage.get('tarja:query-cache')).toBeUndefined();
            expect(await bea.storage.get('tarja:outbox')).toEqual(['bea']);
            expect(await bea.storage.get('tarja:group-outbox')).toEqual(['bea in a group']);
            expect(await bea.storage.get('tarja:query-cache')).toEqual({ bea: true });
        });

        it('forgets the group last shared with of that user, and of nobody else', async () => {
            rememberSharedWith('ana', 'group-of-ana');
            rememberSharedWith('bea', 'group-of-bea');

            await createUserStorage(createMemoryStorage(), 'ana').discard();

            expect(readSharedWith('ana')).toBeNull();
            expect(readSharedWith('bea')).toBe('group-of-bea');
        });

        it('forgets it even when the storage cannot delete', async () => {
            const blocked = {
                ...createMemoryStorage(),
                remove: async () => {
                    throw new Error('The storage is blocked');
                },
            };
            rememberSharedWith('ana', 'group-of-ana');

            await expect(createUserStorage(blocked, 'ana').discard()).rejects.toThrow('The storage is blocked');

            expect(readSharedWith('ana')).toBeNull();
        });

        it('deletes data it never touched in this session', async () => {
            const storage = createMemoryStorage();
            await storage.set('tarja:outbox:ana', ['left from before']);
            await storage.set('tarja:group-outbox:ana', ['left from before']);
            await storage.set('tarja:query-cache:ana', { left: true });

            await createUserStorage(storage, 'ana').discard();

            expect(await storage.get('tarja:outbox:ana')).toBeUndefined();
            expect(await storage.get('tarja:group-outbox:ana')).toBeUndefined();
            expect(await storage.get('tarja:query-cache:ana')).toBeUndefined();
        });

        it('ignores a late write, such as a throttled save of the cache', async () => {
            const storage = createMemoryStorage();
            const ana = createUserStorage(storage, 'ana');
            await ana.discard();

            await ana.storage.set('tarja:query-cache', { late: true });

            expect(await storage.get('tarja:query-cache:ana')).toBeUndefined();
        });
    });
});
