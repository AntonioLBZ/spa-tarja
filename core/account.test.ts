import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { EMAIL_MAX_LENGTH, accountDeletionSchema, confirmsEmail } from './account';

describe('confirmsEmail', () => {
    it('takes the email of the account as it is', () => {
        expect(confirmsEmail('ana@example.com', 'ana@example.com')).toBe(true);
    });

    it('takes it in any case and with spaces around it', () => {
        expect(confirmsEmail('  Ana@Example.COM ', 'ana@example.com')).toBe(true);
    });

    it('refuses any other email, a part of it and nothing', () => {
        expect(confirmsEmail('bruno@example.com', 'ana@example.com')).toBe(false);
        expect(confirmsEmail('ana@example', 'ana@example.com')).toBe(false);
        expect(confirmsEmail('ana @example.com', 'ana@example.com')).toBe(false);
        expect(confirmsEmail('', 'ana@example.com')).toBe(false);
    });
});

describe('accountDeletionSchema', () => {
    it('takes an email up to the longest one there can be', () => {
        expect(v.is(accountDeletionSchema, { email: 'ana@example.com' })).toBe(true);
        expect(v.is(accountDeletionSchema, { email: 'a'.repeat(EMAIL_MAX_LENGTH) })).toBe(true);
    });

    it('refuses a body without an email, one that is not text and one too long', () => {
        expect(v.is(accountDeletionSchema, {})).toBe(false);
        expect(v.is(accountDeletionSchema, { email: null })).toBe(false);
        expect(v.is(accountDeletionSchema, { email: 42 })).toBe(false);
        expect(v.is(accountDeletionSchema, { email: 'a'.repeat(EMAIL_MAX_LENGTH + 1) })).toBe(false);
    });
});
