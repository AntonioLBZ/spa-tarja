import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CURRENCY, formatAmount, formatAmountInput, parseAmount } from '@core/money';

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
    it('draws another symbol in the place of the currency, where the locale puts it', () => {
        expect(formatAmount(123456, DEFAULT_CURRENCY, 'en', '$')).toBe('$1,234.56');
        expect(formatAmount(-2150, DEFAULT_CURRENCY, 'es', '£')).toBe('-21,50\u00a0£');
    });

    it('formats cents with the currency and the locale conventions', () => {
        expect(formatAmount(123456, DEFAULT_CURRENCY, 'en')).toBe('€1,234.56');
        expect(formatAmount(123456, DEFAULT_CURRENCY, 'es')).toBe('1234,56 €');
    });
});

describe('formats made once', () => {
    it('keep each locale and currency apart, whatever was formatted before', () => {
        expect(formatAmount(123456, 'EUR', 'en')).toBe('€1,234.56');
        expect(formatAmount(123456, 'EUR', 'es')).toBe('1234,56\u00a0€');
        expect(formatAmount(123456, 'USD', 'en')).toBe('$1,234.56');
        expect(formatAmountInput(123456, 'es')).toBe('1234,56');
        expect(formatAmountInput(123456, 'en')).toBe('1234.56');
        expect(formatAmount(123456, 'EUR', 'en')).toBe('€1,234.56');
    });

    it('are made once for each locale and currency', () => {
        const made = vi.spyOn(Intl, 'NumberFormat');

        formatAmount(100, 'EUR', 'fr');
        formatAmount(250, 'EUR', 'fr');
        formatAmount(100, 'GBP', 'fr');

        expect(made).toHaveBeenCalledTimes(2);
        made.mockRestore();
    });
});

describe('formatAmountInput', () => {
    it('writes cents the way a person would type them, with two decimals and no grouping', () => {
        expect(formatAmountInput(123456, 'en')).toBe('1234.56');
        expect(formatAmountInput(123456, 'es')).toBe('1234,56');
        expect(formatAmountInput(500, 'en')).toBe('5.00');
        expect(formatAmountInput(5, 'en')).toBe('0.05');
    });

    it('is read back as the same cents', () => {
        for (const cents of [1, 99, 100, 501, 100000, 123456789]) {
            for (const locale of ['en', 'es'])
                expect(parseAmount(formatAmountInput(cents, locale), locale)).toBe(cents);
        }
    });
});
