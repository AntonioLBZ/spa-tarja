import { describe, expect, it } from 'vitest';

import { DEFAULT_CURRENCY, formatAmount, parseAmount } from './money';

describe('parseAmount', () => {
    it('reads a whole number as cents', () => {
        expect(parseAmount('12', 'en')).toBe(1200);
    });

    it('reads the decimal separator of either language', () => {
        expect(parseAmount('12.50', 'en')).toBe(1250);
        expect(parseAmount('12,50', 'es')).toBe(1250);
    });

    it('accepts the other language decimal separator after one or two digits', () => {
        expect(parseAmount('12.5', 'es')).toBe(1250);
        expect(parseAmount('12,50', 'en')).toBe(1250);
    });

    it('pads a single decimal digit', () => {
        expect(parseAmount('0,5', 'es')).toBe(50);
    });

    it('treats a separator followed by three digits as thousands when it is not the locale decimal', () => {
        expect(parseAmount('1.250', 'es')).toBe(125000);
        expect(parseAmount('1,250', 'en')).toBe(125000);
    });

    it('reads grouped amounts with a decimal part', () => {
        expect(parseAmount('1.234,56', 'es')).toBe(123456);
        expect(parseAmount('1,234.56', 'en')).toBe(123456);
        expect(parseAmount('1.234.567', 'es')).toBe(123456700);
    });

    it('ignores spaces and the euro sign', () => {
        expect(parseAmount(' 3,20 € ', 'es')).toBe(320);
        expect(parseAmount('€3.20', 'en')).toBe(320);
    });

    it('rejects more than two decimals, negatives and text', () => {
        expect(parseAmount('1,255', 'es')).toBeNull();
        expect(parseAmount('-4', 'en')).toBeNull();
        expect(parseAmount('abc', 'en')).toBeNull();
        expect(parseAmount('', 'en')).toBeNull();
        expect(parseAmount('1,2,3', 'es')).toBeNull();
    });

    it('rejects amounts too large to be stored safely', () => {
        expect(parseAmount('99999999999', 'en')).toBeNull();
    });
});

describe('formatAmount', () => {
    it('formats cents with the currency and the locale conventions', () => {
        expect(formatAmount(123456, DEFAULT_CURRENCY, 'en')).toBe('€1,234.56');
        expect(formatAmount(123456, DEFAULT_CURRENCY, 'es')).toBe('1234,56 €');
    });
});
