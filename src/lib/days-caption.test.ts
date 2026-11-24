import { describe, expect, it } from 'vitest';

import { daysCaption } from './days-caption';

const words = {
    all: 'All',
    from: (from: string) => `From ${from}`,
    to: (to: string) => `Up to ${to}`,
    between: (from: string, to: string) => `${from} to ${to}`,
};

describe('daysCaption', () => {
    it('says every day while both ends are open', () => {
        expect(daysCaption('', '', words)).toBe('All');
    });

    it('says the end that is set, or both', () => {
        expect(daysCaption('Nov 1', '', words)).toBe('From Nov 1');
        expect(daysCaption('', 'Nov 30', words)).toBe('Up to Nov 30');
        expect(daysCaption('Nov 1', 'Nov 30', words)).toBe('Nov 1 to Nov 30');
    });
});
