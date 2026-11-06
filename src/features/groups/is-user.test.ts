import { describe, expect, it } from 'vitest';

import { person } from '@/lib/test/groups';

import { isUser } from './is-user';

describe('isUser', () => {
    it('is a member who has joined', () => {
        expect(isUser(person('Bea'))).toBe(true);
    });

    it('is not a placeholder', () => {
        expect(isUser(person('Bea', { claimed: false }))).toBe(false);
    });

    it('is not a member who deleted their account, who has no name', () => {
        expect(isUser(person(''))).toBe(false);
    });

    it('does not ask whether the member is still in the group', () => {
        expect(isUser(person('Bea', { leftAt: 1 }))).toBe(true);
    });
});
