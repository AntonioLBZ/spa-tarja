import { afterEach, describe, expect, it } from 'vitest';

import { clearCachedUser, readCachedUser, writeCachedUser } from './session-cache';

const ana = { id: 'user-1', name: 'Ana', email: 'ana@example.com' };

afterEach(() => localStorage.clear());

describe('session cache', () => {
    it('has no user until one is written', () => {
        expect(readCachedUser()).toBeNull();
    });

    it('gives back the user that was written', () => {
        writeCachedUser(ana);

        expect(readCachedUser()).toEqual(ana);
    });

    it('forgets the user once cleared', () => {
        writeCachedUser(ana);

        clearCachedUser();

        expect(readCachedUser()).toBeNull();
    });

    it('keeps only the profile fields', () => {
        localStorage.setItem('tarja:session', JSON.stringify({ ...ana, token: 'secret' }));

        expect(readCachedUser()).toEqual(ana);
    });

    it.each(['not json', '{}', '[]', 'null', JSON.stringify({ id: 1, name: 'Ana', email: 'ana@example.com' })])(
        'ignores an entry that is not a profile: %s',
        (stored) => {
            localStorage.setItem('tarja:session', stored);

            expect(readCachedUser()).toBeNull();
        }
    );
});
