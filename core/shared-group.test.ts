import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
    MAX_GROUP_MEMBERS,
    SHARED_NAME_MAX_LENGTH,
    groupChangeSchema,
    groupWriteSchema,
    memberWriteSchema,
    mergeSchema,
    mySwitchesSchema,
    newGroupSchema,
    ownerSchema,
} from './shared-group';

const ANA = '6a1f4c2e-8b3d-4e5f-9a7b-1c2d3e4f5a6b';
const BRUNO = '7b2e5d3f-9c4e-4f6a-8b8c-2d3e4f5a6b7c';
const CARLA = '8c3f6e4a-ad5f-4a7b-9c9d-3e4f5a6b7c8d';
const FRIEND = '9d4a7f5b-be6a-4b8c-8dae-4f5a6b7c8d9e';

const trip = {
    kind: 'group',
    name: 'Trip to Lisbon',
    currency: 'EUR',
    me: { id: ANA },
    others: [
        { id: BRUNO, name: 'Bruno' },
        { id: CARLA, name: 'Carla' },
    ],
};

const friend = {
    kind: 'direct',
    currency: 'EUR',
    me: { id: ANA },
    others: [{ id: BRUNO, name: 'Bruno' }],
};

function others(count: number) {
    return Array.from({ length: count }, () => ({ id: crypto.randomUUID(), name: 'Someone' }));
}

describe('newGroupSchema', () => {
    it('keeps a group with its name and its people, the names trimmed', () => {
        const result = v.safeParse(newGroupSchema, {
            ...trip,
            name: '  Trip to Lisbon ',
            others: [{ id: BRUNO, name: ' Bruno ' }],
        });

        expect(result.success).toBe(true);
        expect(result.output).toEqual({ ...trip, others: [{ id: BRUNO, name: 'Bruno' }] });
    });

    it('keeps a group of only the maker', () => {
        expect(v.safeParse(newGroupSchema, { ...trip, others: [] }).success).toBe(true);
    });

    it('keeps a friend without a name', () => {
        const result = v.safeParse(newGroupSchema, friend);

        expect(result.success).toBe(true);
        expect(result.output).toEqual({ ...friend, name: null });
    });

    it('takes a group of the most members there can be, and refuses one more', () => {
        expect(v.safeParse(newGroupSchema, { ...trip, others: others(MAX_GROUP_MEMBERS - 1) }).success).toBe(true);
        expect(v.safeParse(newGroupSchema, { ...trip, others: others(MAX_GROUP_MEMBERS) }).success).toBe(false);
    });

    it.each([
        ['a group without a name', { name: undefined }],
        ['a group whose name is null', { name: null }],
        ['an unknown kind', { kind: 'club' }],
        ['a maker whose id is not a UUID', { me: { id: 'ana' } }],
        ['nobody as the maker', { me: undefined }],
        ['another whose id is not a UUID', { others: [{ id: 'bruno', name: 'Bruno' }] }],
        ['another without a name', { others: [{ id: BRUNO }] }],
        [
            'the same id twice',
            {
                others: [
                    { id: BRUNO, name: 'Bruno' },
                    { id: BRUNO, name: 'Bruno' },
                ],
            },
        ],
        ['the maker among the others', { others: [{ id: ANA, name: 'Ana' }] }],
        ['a currency that is not a code', { currency: 'euro' }],
        ['no currency', { currency: undefined }],
    ])('refuses %s', (_, overrides) => {
        expect(v.safeParse(newGroupSchema, { ...trip, ...overrides }).success).toBe(false);
    });

    it.each([
        ['with a name', { name: 'Bruno' }],
        ['with nobody else', { others: [] }],
        [
            'with two others',
            {
                others: [
                    { id: BRUNO, name: 'Bruno' },
                    { id: CARLA, name: 'Carla' },
                ],
            },
        ],
    ])('refuses a friend %s', (_, overrides) => {
        expect(v.safeParse(newGroupSchema, { ...friend, ...overrides }).success).toBe(false);
    });
});

describe('the names of groups and people', () => {
    it('take the most characters there can be, counted after trimming', () => {
        const name = 'x'.repeat(SHARED_NAME_MAX_LENGTH);

        expect(v.parse(groupChangeSchema, { name: ` ${name} ` })).toEqual({ name });
        expect(v.parse(memberWriteSchema, { name: ` ${name} ` })).toEqual({ name });
    });

    it.each([
        ['empty', ''],
        ['only spaces', '   '],
        ['nothing visible', '​⁠'],
        ['too long', 'x'.repeat(SHARED_NAME_MAX_LENGTH + 1)],
        ['not a string', 7],
    ])('refuse a name that is %s', (_, name) => {
        expect(v.safeParse(groupChangeSchema, { name }).success).toBe(false);
        expect(v.safeParse(memberWriteSchema, { name }).success).toBe(false);
        expect(v.safeParse(newGroupSchema, { ...trip, name }).success).toBe(false);
        expect(v.safeParse(newGroupSchema, { ...trip, others: [{ id: BRUNO, name }] }).success).toBe(false);
    });
});

describe('groupChangeSchema', () => {
    it('takes the name, the switch of the simplified debts, both or neither', () => {
        expect(v.parse(groupChangeSchema, { name: 'Flat' })).toEqual({ name: 'Flat' });
        expect(v.parse(groupChangeSchema, { simplifyDebts: true })).toEqual({ simplifyDebts: true });
        expect(v.parse(groupChangeSchema, { name: 'Flat', simplifyDebts: false })).toEqual({
            name: 'Flat',
            simplifyDebts: false,
        });
        expect(v.parse(groupChangeSchema, {})).toEqual({});
    });

    it('refuses a switch that is not a boolean', () => {
        expect(v.safeParse(groupChangeSchema, { simplifyDebts: 1 }).success).toBe(false);
    });
});

describe('groupWriteSchema', () => {
    it('reads a body with a kind as a new group, and one without as a change', () => {
        expect(v.parse(groupWriteSchema, trip)).toEqual(trip);
        expect(v.parse(groupWriteSchema, { name: 'Flat' })).toEqual({ name: 'Flat' });
    });

    it('never reads a new group that is wrong as a change', () => {
        expect(v.safeParse(groupWriteSchema, { ...trip, others: others(MAX_GROUP_MEMBERS) }).success).toBe(false);
        expect(v.safeParse(groupWriteSchema, { ...friend, name: 'Bruno' }).success).toBe(false);
    });
});

describe('memberWriteSchema', () => {
    it('reads a name as a dummy or a new name', () => {
        expect(v.parse(memberWriteSchema, { name: 'Bruno' })).toEqual({ name: 'Bruno' });
    });

    it('reads a friend, as a new member or in place of a dummy', () => {
        expect(v.parse(memberWriteSchema, { friend: FRIEND })).toEqual({ friend: FRIEND });
        expect(v.parse(memberWriteSchema, { friend: FRIEND, replaces: BRUNO })).toEqual({
            friend: FRIEND,
            replaces: BRUNO,
        });
    });

    it.each([
        ['nothing', {}],
        ['a friend that is not a UUID', { friend: 'bruno' }],
        ['a friend whose dummy is not a UUID', { friend: FRIEND, replaces: 'bruno' }],
        ['a bad friend next to a name', { name: 'Bruno', friend: 'bruno' }],
    ])('refuses %s', (_, body) => {
        expect(v.safeParse(memberWriteSchema, body).success).toBe(false);
    });
});

describe('the merge, the owner and the switches of a person', () => {
    it('name a member by a UUID', () => {
        expect(v.parse(mergeSchema, { into: ANA })).toEqual({ into: ANA });
        expect(v.parse(ownerSchema, { memberId: ANA })).toEqual({ memberId: ANA });
        expect(v.safeParse(mergeSchema, { into: 'ana' }).success).toBe(false);
        expect(v.safeParse(ownerSchema, {}).success).toBe(false);
    });

    it('take either switch, both or neither, as booleans', () => {
        expect(v.parse(mySwitchesSchema, { showInExpenses: false })).toEqual({ showInExpenses: false });
        expect(v.parse(mySwitchesSchema, { archived: true, showInExpenses: true })).toEqual({
            archived: true,
            showInExpenses: true,
        });
        expect(v.parse(mySwitchesSchema, {})).toEqual({});
        expect(v.safeParse(mySwitchesSchema, { archived: 'yes' }).success).toBe(false);
    });
});
