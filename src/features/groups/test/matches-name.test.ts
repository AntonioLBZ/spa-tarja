import { describe, expect, it } from 'vitest';

import { matchesName } from '@/features/groups/matches-name';

describe('matchesName', () => {
    it('finds what was typed anywhere in the name, ignoring case and accents', () => {
        expect(matchesName('Agustín', 'agus')).toBe(true);
        expect(matchesName('Agustín', 'TIN')).toBe(true);
        expect(matchesName('Agustin', 'agustín')).toBe(true);
        expect(matchesName('Ana', 'agus')).toBe(false);
    });

    it('takes every name while nothing is typed', () => {
        expect(matchesName('Ana', '')).toBe(true);
        expect(matchesName('Ana', '   ')).toBe(true);
    });
});
