import { describe, expect, it } from 'vitest';

import { person } from '@/lib/test/groups';

import { memberNames } from './member-names';

const words = {
    deleted: 'Deleted user',
    numbered: (name: string, number: number) => `${name} (${number})`,
};

describe('memberNames', () => {
    it('shows each member by the name the group gives them', () => {
        const ana = person('Ana');
        const bruno = person('Bruno');

        const names = memberNames([ana, bruno], words);

        expect(names.get(ana.id)).toBe('Ana');
        expect(names.get(bruno.id)).toBe('Bruno');
    });

    it('tells two members with the same name apart by a number, in the order the group lists them', () => {
        const first = person('Ana');
        const second = person('ana');
        const third = person('ANA');

        const names = memberNames([first, second, third], words);

        expect([names.get(first.id), names.get(second.id), names.get(third.id)]).toEqual(['Ana', 'ana (2)', 'ANA (3)']);
    });

    it('counts those who left, since the balances still name them', () => {
        const gone = person('Ana', { leftAt: 1 });
        const here = person('Ana');

        expect(memberNames([gone, here], words).get(here.id)).toBe('Ana (2)');
    });

    it('leaves out a merged placeholder, which is read as the member it was merged into', () => {
        const target = person('Ana');
        const dummy = person('Ana', { claimed: false, mergedInto: target.id, leftAt: 1 });

        const names = memberNames([dummy, target], words);

        expect(names.get(target.id)).toBe('Ana');
        expect(names.has(dummy.id)).toBe(false);
    });

    it('calls a member with no name a deleted user, numbered like any other name', () => {
        const first = person('');
        const second = person('');

        const names = memberNames([first, second], words);

        expect([names.get(first.id), names.get(second.id)]).toEqual(['Deleted user', 'Deleted user (2)']);
    });

    it('leaves the stored names as they are', () => {
        const members = [person('Ana'), person('Ana')];

        memberNames(members, words);

        expect(members.map((member) => member.name)).toEqual(['Ana', 'Ana']);
    });
});
