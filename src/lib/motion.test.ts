import { afterEach, describe, expect, it } from 'vitest';

import { readDuration } from './motion';

const root = document.documentElement;

afterEach(() => {
    root.style.removeProperty('--duration-test');
});

describe('readDuration', () => {
    it('reads milliseconds', () => {
        root.style.setProperty('--duration-test', '360ms');

        expect(readDuration('--duration-test')).toBe(360);
    });

    it('reads seconds, which is how the minified stylesheet spells them', () => {
        root.style.setProperty('--duration-test', '1.08s');

        expect(readDuration('--duration-test')).toBe(1080);
    });

    it('is zero for zero, with or without a unit', () => {
        root.style.setProperty('--duration-test', '0s');
        expect(readDuration('--duration-test')).toBe(0);

        root.style.setProperty('--duration-test', '0');
        expect(readDuration('--duration-test')).toBe(0);
    });

    it('is zero when the token is missing', () => {
        expect(readDuration('--duration-test')).toBe(0);
    });
});
