import * as v from 'valibot';

import { DEFAULT_CURRENCY } from './money';
import { hasDirectionControls, isVisibleText, stripDirectionControls } from './text';

import type { Profile } from './profile';
import type { SharedMember } from './shared-member';

// Per user, counting only the groups that aren't closed for them
const MAX_OPEN_GROUPS = 30;

const MAX_FRIENDS = 100;

// Per user, counting the groups and friends that are closed for them, deleted or left, and that they haven't archived:
// a person is not put in more of them than this, nor makes more, until they archive some
const MAX_CLOSED_GROUPS = 100;

// Counting only the members who haven't left
const MAX_GROUP_MEMBERS = 30;

// Counting every member the group ever had, those who left and were merged included, as their rows are never deleted
const MAX_GROUP_MEMBER_ROWS = 100;

// Per user, the invitations that are still open: a link holds no place for anybody, so a person keeps only a few
const MAX_OPEN_INVITATIONS = 20;

const SHARED_NAME_MAX_LENGTH = 40;

// What a group calls a person whose account has no name it can show
const UNNAMED_PERSON = '?';

// In lower case, so that two spellings of one id are the same id wherever ids are compared
const groupIdSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase());

const memberIdSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase());

// The name of a group, or the one a group gives a person
const sharedNameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.maxLength(SHARED_NAME_MAX_LENGTH),
    v.check(isVisibleText, 'Nothing visible'),
    v.check((name) => !hasDirectionControls(name), 'Sets the direction of the text')
);

// At most that many UTF-16 code units, never cutting a character in two
const cutText = (text: string, max: number): string => {
    let cut = '';
    for (const character of text) {
        if (cut.length + character.length > max) break;
        cut += character;
    }
    return cut;
};

// The name a person starts with in a group they make or join: their nickname, else the name of their account cut to
// fit, as long as it is a name a group takes
const personName = ({ nickname, name }: Profile): string => {
    const account = cutText(stripDirectionControls(name).trim(), SHARED_NAME_MAX_LENGTH);
    for (const candidate of [nickname === null ? null : stripDirectionControls(nickname), account]) {
        const parsed = v.safeParse(sharedNameSchema, candidate);
        if (parsed.success) return parsed.output;
    }
    return UNNAMED_PERSON;
};

// A group is in the currency of the app, so what the lists add up is always in one
const currencySchema = v.literal(DEFAULT_CURRENCY);

// The maker is named by the server, after their nickname or their account
const makerSchema = v.object({ id: memberIdSchema });

const placeholderSchema = v.object({ id: memberIdSchema, name: sharedNameSchema });

// A group and its first people: the maker, who owns it, and the others as dummies. Only a group is made this way: a
// friend comes from an accepted invitation.
const newGroupSchema = v.pipe(
    v.object({
        kind: v.literal('group'),
        name: sharedNameSchema,
        currency: currencySchema,
        me: makerSchema,
        others: v.pipe(v.array(placeholderSchema), v.maxLength(MAX_GROUP_MEMBERS - 1)),
    }),
    v.check(({ me, others }) => {
        const ids = [me.id, ...others.map((other) => other.id)];
        return new Set(ids).size === ids.length;
    }, 'A member is there twice')
);

// What the owner changes of a group that exists; a friend has no name to change
const groupChangeSchema = v.object({
    kind: v.optional(v.never()),
    name: v.optional(sharedNameSchema),
    simplifyDebts: v.optional(v.boolean()),
});

// A body with a kind makes the group, and is read as a change when the group is there already
const groupWriteSchema = v.union([newGroupSchema, groupChangeSchema]);

// A dummy by name, or a new name for a member; or one of the caller's friends who is a real person, the friend group
// named by its id, as a new member or in place of a dummy
const memberWriteSchema = v.union([
    v.object({ friend: groupIdSchema, replaces: v.optional(memberIdSchema) }),
    v.object({ friend: v.optional(v.never()), name: sharedNameSchema }),
]);

const mergeSchema = v.object({ into: memberIdSchema });

const ownerSchema = v.object({ memberId: memberIdSchema });

// The caller's own switches for a group
const mySwitchesSchema = v.object({
    showInExpenses: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
});

// A `group` has a name and any number of members; a `direct` one is a friend, two members and no name
type GroupKind = 'group' | 'direct';

type MemberRole = 'owner' | 'member';

// Why a group is read-only for a person: it was deleted, or they left it
type GroupClosed = 'deleted' | 'left';

type NewGroup = v.InferOutput<typeof newGroupSchema>;

type GroupChange = v.InferOutput<typeof groupChangeSchema>;

type MemberWrite = v.InferOutput<typeof memberWriteSchema>;

type MySwitches = v.InferOutput<typeof mySwitchesSchema>;

// A member as a group tells it: never the user behind it. An empty name is a person who deleted their account.
interface GroupMember extends SharedMember {
    name: string;
    role: MemberRole;
    // A person, now or before they deleted their account; a dummy until then
    claimed: boolean;
    leftAt: number | null;
}

// A group or a friend as one of its members sees it
interface SharedGroup {
    id: string;
    kind: GroupKind;
    name: string | null;
    currency: string;
    simplifyDebts: boolean;
    closed: GroupClosed | null;
    archived: boolean;
    // The caller's member
    me: string;
    showInExpenses: boolean;
    // In the group's order, those who left included
    members: GroupMember[];
}

export {
    MAX_CLOSED_GROUPS,
    MAX_FRIENDS,
    MAX_GROUP_MEMBERS,
    MAX_GROUP_MEMBER_ROWS,
    MAX_OPEN_GROUPS,
    MAX_OPEN_INVITATIONS,
    SHARED_NAME_MAX_LENGTH,
    UNNAMED_PERSON,
    groupChangeSchema,
    groupIdSchema,
    groupWriteSchema,
    memberIdSchema,
    memberWriteSchema,
    mergeSchema,
    mySwitchesSchema,
    newGroupSchema,
    ownerSchema,
    personName,
    sharedNameSchema,
    type GroupChange,
    type GroupClosed,
    type GroupKind,
    type GroupMember,
    type MemberRole,
    type MemberWrite,
    type MySwitches,
    type NewGroup,
    type SharedGroup,
};
