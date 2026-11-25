import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '@/lib/a11y/use-debounced-value';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useDebouncedValue', () => {
    it('starts with the value it is given', () => {
        const { result } = renderHook(() => useDebouncedValue('three', 500));

        expect(result.current).toBe('three');
    });

    it('keeps the old value until the new one has held still for the delay', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 500), {
            initialProps: { value: 'one' },
        });

        rerender({ value: 'two' });
        act(() => vi.advanceTimersByTime(499));
        expect(result.current).toBe('one');

        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe('two');
    });

    it('starts the wait again with each change, so a burst of changes gives only the last', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 500), {
            initialProps: { value: 'a' },
        });

        rerender({ value: 'b' });
        act(() => vi.advanceTimersByTime(400));
        rerender({ value: 'c' });
        act(() => vi.advanceTimersByTime(400));
        expect(result.current).toBe('a');

        act(() => vi.advanceTimersByTime(100));
        expect(result.current).toBe('c');
    });

    it('uses half a second when no delay is given', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
            initialProps: { value: 'one' },
        });

        rerender({ value: 'two' });
        act(() => vi.advanceTimersByTime(499));
        expect(result.current).toBe('one');

        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe('two');
    });
});
