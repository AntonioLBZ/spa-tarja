import { describe, expect, it } from 'vitest';

import { isUser } from '@/features/groups/people/is-user';
import { person } from '@/lib/testing/groups';

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
