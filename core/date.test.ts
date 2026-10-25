import { describe, expect, it } from 'vitest';

import { isCalendarDate, toDateString } from './date';

describe('isCalendarDate', () => {
    it('accepts real days, leap day included', () => {
        expect(isCalendarDate('2026-10-25')).toBe(true);
        expect(isCalendarDate('2028-02-29')).toBe(true);
    });

    it('rejects days that do not exist', () => {
        expect(isCalendarDate('2026-02-30')).toBe(false);
        expect(isCalendarDate('2027-02-29')).toBe(false);
        expect(isCalendarDate('2026-13-01')).toBe(false);
        expect(isCalendarDate('2026-00-10')).toBe(false);
    });

    it('rejects anything that is not YYYY-MM-DD', () => {
        expect(isCalendarDate('25/10/2026')).toBe(false);
        expect(isCalendarDate('2026-1-5')).toBe(false);
        expect(isCalendarDate('2026-10-25T10:00:00Z')).toBe(false);
        expect(isCalendarDate('')).toBe(false);
    });
});

describe('toDateString', () => {
    it('writes the local calendar day, padded', () => {
        expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
        expect(toDateString(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
    });
});
