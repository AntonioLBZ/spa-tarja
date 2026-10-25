import { describe, expect, it } from 'vitest';

import { addDays, addMonths, fromDateString, isCalendarDate, startOfWeek, toDateString } from './date';

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

describe('fromDateString', () => {
    it('reads the day at local midnight, whatever the time zone', () => {
        const date = fromDateString('2026-10-25');

        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 25, 0]);
    });

    it('round-trips with toDateString', () => {
        expect(toDateString(fromDateString('2028-02-29'))).toBe('2028-02-29');
    });
});

describe('addMonths', () => {
    it.each([
        ['2026-10-25', 1, '2026-11-25'],
        ['2026-12-15', 1, '2027-01-15'],
        ['2026-10-25', 0, '2026-10-25'],
        ['2026-10-25', 3, '2027-01-25'],
        ['2026-01-31', 1, '2026-02-28'],
        ['2028-01-31', 1, '2028-02-29'],
        ['2026-03-31', 1, '2026-04-30'],
        ['2026-01-31', 2, '2026-03-31'],
        ['2026-01-31', 13, '2027-02-28'],
    ])('moves %s by %i months to %s, keeping to the last day of a shorter month', (from, months, to) => {
        expect(addMonths(from, months)).toBe(to);
    });
});

describe('addDays', () => {
    it('moves forward and back within a month', () => {
        expect(addDays('2026-10-25', 3)).toBe('2026-10-28');
        expect(addDays('2026-10-25', -3)).toBe('2026-10-22');
        expect(addDays('2026-10-25', 0)).toBe('2026-10-25');
    });

    it('crosses months and years', () => {
        expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
        expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
        expect(addDays('2027-01-02', -3)).toBe('2026-12-30');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('knows leap years', () => {
        expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
        expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    });

    it('moves a long way', () => {
        expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
        expect(addDays('2026-10-25', -84)).toBe('2026-08-02');
    });
});

describe('startOfWeek', () => {
    it('is the Monday of the week the day is in', () => {
        expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
        expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
        expect(startOfWeek('2026-10-21')).toBe('2026-10-19');
        expect(startOfWeek('2026-10-20')).toBe('2026-10-19');
    });

    it('can start in the month or the year before', () => {
        expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
        expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
    });
});
