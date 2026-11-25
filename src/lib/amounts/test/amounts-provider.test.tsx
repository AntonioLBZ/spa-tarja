import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAmount, useAmountPreferences, useMoney } from '@/lib/amounts/amounts-provider';
import { createFakeApi } from '@/lib/testing/fake-api';
import { renderAppHook, stubApi } from '@/lib/testing/render-app';

const render = () => {
    stubApi(createFakeApi().handler);
    return renderAppHook(() => ({ money: useMoney(), amount: useAmount(), ...useAmountPreferences() }));
};

afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-money-palette');
});

describe('useMoney', () => {
    it('writes the app currency with the symbol chosen, and any other with its own', async () => {
        const { result } = render();
        await waitFor(() => expect(result.current).not.toBeNull());

        expect(result.current.money(2150)).toBe('€21.50');

        act(() => result.current.setPreferences({ symbol: '$' }));

        expect(result.current.money(2150)).toBe('$21.50');
        expect(result.current.money(2150, 'GBP')).toBe('£21.50');
    });
});

describe('useAmount', () => {
    it('gives no cue unless the screen asks for them', async () => {
        const { result } = render();
        await waitFor(() => expect(result.current).not.toBeNull());

        expect(result.current.amount(-1250)).toEqual({
            text: '€12.50',
            direction: 'out',
            color: false,
            sign: false,
            arrow: false,
        });
    });

    it('gives the arrow only where the screen asks for it and the cues the person allows', async () => {
        const { result } = render();
        await waitFor(() => expect(result.current).not.toBeNull());

        expect(result.current.amount(2000, undefined, { cues: true })).toMatchObject({
            direction: 'in',
            color: true,
            sign: true,
            arrow: false,
        });
        expect(result.current.amount(2000, undefined, { cues: true, arrow: true }).arrow).toBe(true);

        act(() => result.current.setPreferences({ color: false, arrows: false }));

        expect(result.current.amount(2000, undefined, { cues: true, arrow: true })).toMatchObject({
            color: false,
            sign: true,
            arrow: false,
        });
    });
});
