import { describe, expect, it } from 'vitest';

import { weekStartOf } from './week-start';

describe('weekStartOf', () => {
    it('follows the region of the first language', () => {
        expect(weekStartOf(['en-US', 'es-ES'])).toBe(7);
        expect(weekStartOf(['es-ES', 'en-US'])).toBe(1);
        expect(weekStartOf(['en-GB'])).toBe(1);
    });

    it('skips what names no locale', () => {
        expect(weekStartOf(['not a locale', 'en-US'])).toBe(7);
    });

    it('starts on Monday when there is nothing to go by', () => {
        expect(weekStartOf([])).toBe(1);
    });
});
