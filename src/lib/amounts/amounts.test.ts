import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_AMOUNT_PREFERENCES, applyMoneyPalette, readStoredAmounts, storeAmounts } from './amounts';

const root = document.documentElement;

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-money-palette');
    vi.restoreAllMocks();
});

describe('amount preferences', () => {
    it('start with every cue on, the usual palette and the euro', () => {
        expect(readStoredAmounts()).toEqual({ color: true, sign: true, arrows: true, colorBlind: false, symbol: '€' });
    });

    it('come back as they were stored', () => {
        storeAmounts({ color: false, sign: true, arrows: false, colorBlind: true, symbol: '£' });

        expect(readStoredAmounts()).toEqual({ color: false, sign: true, arrows: false, colorBlind: true, symbol: '£' });
    });

    it('keep the default of a field that holds something else, and the others as stored', () => {
        localStorage.setItem('tarja:amounts', JSON.stringify({ color: 'no', sign: false, symbol: '₿' }));

        expect(readStoredAmounts()).toEqual({ ...DEFAULT_AMOUNT_PREFERENCES, sign: false });
    });

    it('fall back to the defaults when what is stored is not JSON or storage is blocked', () => {
        localStorage.setItem('tarja:amounts', '{');
        expect(readStoredAmounts()).toEqual(DEFAULT_AMOUNT_PREFERENCES);

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readStoredAmounts()).toEqual(DEFAULT_AMOUNT_PREFERENCES);
    });
});

describe('applyMoneyPalette', () => {
    it('marks the root for color blindness and takes the mark away', () => {
        applyMoneyPalette(true);
        expect(root.dataset.moneyPalette).toBe('color-blind');

        applyMoneyPalette(false);
        expect(root.hasAttribute('data-money-palette')).toBe(false);
    });
});
