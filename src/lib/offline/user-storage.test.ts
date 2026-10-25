import { describe, expect, it } from 'vitest';

import { createMemoryStorage } from '@/lib/test/memory-storage';

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
        it("deletes the outbox and the cache of the user, and nobody else's", async () => {
            const storage = createMemoryStorage();
            const ana = createUserStorage(storage, 'ana');
            const bea = createUserStorage(storage, 'bea');
            await ana.storage.set('tarja:outbox', ['ana']);
            await ana.storage.set('tarja:query-cache', { ana: true });
            await bea.storage.set('tarja:outbox', ['bea']);
            await bea.storage.set('tarja:query-cache', { bea: true });

            await ana.discard();

            expect(await ana.storage.get('tarja:outbox')).toBeUndefined();
            expect(await ana.storage.get('tarja:query-cache')).toBeUndefined();
            expect(await bea.storage.get('tarja:outbox')).toEqual(['bea']);
            expect(await bea.storage.get('tarja:query-cache')).toEqual({ bea: true });
        });

        it('deletes data it never touched in this session', async () => {
            const storage = createMemoryStorage();
            await storage.set('tarja:outbox:ana', ['left from before']);
            await storage.set('tarja:query-cache:ana', { left: true });

            await createUserStorage(storage, 'ana').discard();

            expect(await storage.get('tarja:outbox:ana')).toBeUndefined();
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
