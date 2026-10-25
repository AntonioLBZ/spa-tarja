import { describe, expect, it } from 'vitest';

import en from '../en.json';
import es from '../es.json';

const locales = { en, es };

function collectEntries(obj: unknown, prefix = ''): [string, unknown][] {
    if (typeof obj !== 'object' || obj === null) return [[prefix, obj]];

    return Object.entries(obj).flatMap(([key, value]) => collectEntries(value, prefix ? `${prefix}.${key}` : key));
}

describe('locale files', () => {
    const enKeys = collectEntries(en)
        .map(([key]) => key)
        .sort();

    it.each(Object.entries(locales).filter(([name]) => name !== 'en'))(
        'en.json and %s.json expose exactly the same set of keys',
        (_name, messages) => {
            const keys = collectEntries(messages)
                .map(([key]) => key)
                .sort();
            expect(keys).toEqual(enKeys);
        }
    );

    it.each(Object.entries(locales))('%s.json has no empty message', (_name, messages) => {
        const empty = collectEntries(messages).filter(([, value]) => typeof value !== 'string' || value.trim() === '');
        expect(empty).toEqual([]);
    });
});
