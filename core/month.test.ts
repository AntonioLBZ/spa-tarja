import { describe, expect, it } from 'vitest';

import { isMonth, monthOf, shiftMonth } from './month';

describe('isMonth', () => {
    it('accepts a year and a month of the calendar', () => {
        expect(isMonth('2026-10')).toBe(true);
        expect(isMonth('2026-01')).toBe(true);
        expect(isMonth('2026-12')).toBe(true);
    });

    it('rejects anything else', () => {
        for (const value of [
            '2026-00',
            '2026-13',
            '2026-1',
            '26-10',
            '2026-10-01',
            '2026/10',
            '12026-10',
            'x2026-10',
            '',
            'October',
        ]) {
            expect(isMonth(value)).toBe(false);
        }
    });
});

describe('monthOf', () => {
    it('is the month a day falls in', () => {
        expect(monthOf('2026-10-25')).toBe('2026-10');
        expect(monthOf('2026-01-01')).toBe('2026-01');
    });
});

describe('shiftMonth', () => {
    it('moves forward and back', () => {
        expect(shiftMonth('2026-10', 1)).toBe('2026-11');
        expect(shiftMonth('2026-10', -1)).toBe('2026-09');
        expect(shiftMonth('2026-10', 0)).toBe('2026-10');
    });

    it('crosses the turn of the year', () => {
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftMonth('2026-10', 15)).toBe('2028-01');
        expect(shiftMonth('2026-10', -10)).toBe('2025-12');
    });
});
