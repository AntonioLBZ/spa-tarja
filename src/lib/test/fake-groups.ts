import * as v from 'valibot';

import { INVITATION_DAYS, type PendingInvitation } from '@core/invitation';
import { sharedEntryInputSchema, type LedgerEntry, type SharedEntry } from '@core/shared-entry';
import {
    groupWriteSchema,
    memberWriteSchema,
    mergeSchema,
    mySwitchesSchema,
    ownerSchema,
    personName,
    type GroupMember,
    type MemberRole,
    type SharedGroup,
} from '@core/shared-group';

import type { Profile } from '@core/profile';

// An answer the fake gives instead of doing what was asked
interface Refusal {
    status: number;
    error?: string;
}

// A link the test user opens: the name of who asks and the friend the test user becomes by accepting it
interface IncomingInvitation {
    token: string;
    name: string;
    friend: SharedGroup;
}

type LinkAction = 'read' | 'accept' | 'decline';

// An entry of a group as a test seeds it; the test user wrote it unless it says who did
type SeededEntry = SharedEntry & { groupId: string; createdBy?: string | null; updatedBy?: string | null };

interface FakeGroupsOptions {
    // The groups and friends as the test user sees them
    groups?: SharedGroup[];
    entries?: SeededEntry[];
    // Most rows per page, whatever the client asks for
    pageSize?: number;
    // The links the test user can open
    incoming?: IncomingInvitation[];
    // The open links to be friends the test user made, newest first
    pending?: PendingInvitation[];
}

interface FakeGroupsState {
    // Answers every change of a group, of its people or of the links of the test user with it
    groupRefusal: Refusal | null;
    // Answers every write of an entry with it
    entryRefusal: Refusal | null;
    // An entry write lands, and then the connection drops before its answer arrives
    loseEntryAnswers: boolean;
    // Answers what is done with a link with these, instead of doing it
    linkRefusals: Partial<Record<LinkAction, Refusal>>;
}

const refuse = ({ status, error }: Refusal) => {
    return error ? Response.json({ error }, { status }) : new Response(null, { status });
};

const json = (init?: RequestInit): unknown => JSON.parse(String(init?.body));

const DAY = 24 * 60 * 60 * 1000;

const newMember = (id: string, name: string, claimed: boolean, role: MemberRole = 'member'): GroupMember => {
    return { id, name, role, claimed, leftAt: null, mergedInto: null };
};

// The groups part of the fake Worker: each group with its own cursor, last write wins, a closed group refusing writes,
// and someone who left reading only up to the cursor the group had then
const createFakeGroups = (options: FakeGroupsOptions, state: FakeGroupsState, profile: Profile) => {
    const groups: SharedGroup[] = structuredClone(options.groups ?? []);
    // How far the test user reads a group they left
    const leftSeq = new Map<string, number>();
    const rows: Array<{ groupId: string; entry: LedgerEntry; seq: number }> = [];
    const groupRequests: string[] = [];
    const entryAttempts: SharedEntry[] = [];
    const entryWrites: LedgerEntry[] = [];
    const links = new Map((options.incoming ?? []).map((link) => [link.token, link]));
    const pending: PendingInvitation[] = structuredClone(options.pending ?? []);

    const groupOf = (groupId: string) => groups.find((group) => group.id === groupId);
    const cursorOf = (groupId: string) =>
        Math.max(0, ...rows.filter((row) => row.groupId === groupId).map((row) => row.seq));

    const storeEntry = (groupId: string, entry: LedgerEntry) => {
        const seq = cursorOf(groupId) + 1;
        const at = rows.findIndex((row) => row.entry.id === entry.id);
        if (at >= 0) rows[at] = { groupId, entry, seq };
        else rows.push({ groupId, entry, seq });
    };

    for (const { groupId, createdBy, updatedBy, ...entry } of options.entries ?? []) {
        const me = groupOf(groupId)?.me ?? null;
        storeEntry(groupId, {
            ...entry,
            createdBy: createdBy === undefined ? me : createdBy,
            updatedBy: updatedBy === undefined ? me : updatedBy,
        });
    }

    const newGroup = (groupId: string, body: unknown): SharedGroup | Refusal => {
        const parsed = v.safeParse(groupWriteSchema, body);
        if (!parsed.success || parsed.output.kind === undefined) return { status: 400, error: 'invalid' };
        const input = parsed.output;
        const group: SharedGroup = {
            id: groupId,
            kind: input.kind,
            name: input.kind === 'group' ? input.name : null,
            currency: input.currency,
            simplifyDebts: false,
            closed: null,
            archived: false,
            me: input.me.id,
            showInExpenses: true,
            members: [
                newMember(input.me.id, personName(profile), true, 'owner'),
                ...input.others.map((other) => newMember(other.id, other.name, false)),
            ],
        };
        groups.push(group);
        return group;
    };

    // A change to a group that is there, or the reason it is refused
    const changeGroup = (group: SharedGroup, path: string, method: string, init?: RequestInit): Refusal | null => {
        const member = (id: string) => group.members.find((candidate) => candidate.id === id);

        if (path === '' && method === 'DELETE') {
            group.closed ??= 'deleted';
            return null;
        }
        if (path === '/me' && method === 'PUT') {
            const input = v.parse(mySwitchesSchema, json(init));
            if (input.archived && group.closed === null) return { status: 409, error: 'not-closed' };
            group.showInExpenses = input.showInExpenses ?? group.showInExpenses;
            group.archived = input.archived ?? group.archived;
            return null;
        }
        if (group.closed !== null) return { status: 409, error: 'closed' };

        if (path === '' && method === 'PUT') {
            const input = v.parse(groupWriteSchema, json(init));
            if (input.kind !== undefined) return null;
            group.name = group.kind === 'group' ? (input.name ?? group.name) : null;
            group.simplifyDebts = input.simplifyDebts ?? group.simplifyDebts;
            return null;
        }
        if (path === '/owner' && method === 'POST') {
            const { memberId } = v.parse(ownerSchema, json(init));
            for (const candidate of group.members) candidate.role = candidate.id === memberId ? 'owner' : 'member';
            return null;
        }

        const [, memberId, action] = /^\/members\/([^/]+)(\/merge)?$/.exec(path) ?? [];
        if (!memberId) return { status: 404 };
        if (action && method === 'POST') {
            const { into } = v.parse(mergeSchema, json(init));
            const dummy = member(memberId);
            if (!dummy) return { status: 404, error: 'unknown-member' };
            Object.assign(dummy, { mergedInto: into, leftAt: Date.now() });
            return null;
        }
        if (method === 'DELETE') {
            const leaving = member(memberId);
            if (!leaving) return { status: 404, error: 'unknown-member' };
            leaving.leftAt ??= Date.now();
            if (memberId === group.me) {
                group.closed = 'left';
                leftSeq.set(group.id, cursorOf(group.id));
            }
            return null;
        }
        if (method === 'PUT') {
            const input = v.parse(memberWriteSchema, json(init));
            if (input.friend === undefined) {
                const existing = member(memberId);
                if (existing) existing.name = input.name;
                else group.members.push(newMember(memberId, input.name, false));
                return null;
            }
            const friend = groupOf(input.friend);
            const other = friend?.members.find((candidate) => candidate.id !== friend.me);
            if (!other?.claimed) return { status: 422, error: 'unknown-friend' };
            group.members.push(newMember(memberId, other.name, true));
            const dummy = input.replaces === undefined ? undefined : member(input.replaces);
            if (dummy) Object.assign(dummy, { mergedInto: memberId, leftAt: Date.now() });
            return null;
        }
        return { status: 404 };
    };

    const writeEntry = (group: SharedGroup, id: string, init?: RequestInit): Response => {
        const parsed = v.safeParse(sharedEntryInputSchema, json(init));
        if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
        const input = parsed.output;
        entryAttempts.push({ ...input, id });
        const stored = rows.find((row) => row.entry.id === id);
        if (stored && stored.groupId !== group.id) return Response.json({ error: 'id-taken' }, { status: 409 });
        if (group.closed !== null) {
            const landed = stored?.entry.updatedAt === input.updatedAt;
            return landed ? Response.json(stored.entry) : Response.json({ error: 'closed' }, { status: 409 });
        }
        if (state.entryRefusal) return refuse(state.entryRefusal);
        if (stored && stored.entry.updatedAt >= input.updatedAt) return Response.json(stored.entry);

        const written: LedgerEntry = {
            ...input,
            id,
            createdBy: stored?.entry.createdBy ?? group.me,
            updatedBy: group.me,
        };
        storeEntry(group.id, written);
        entryWrites.push(written);
        if (state.loseEntryAnswers) throw new TypeError('Failed to fetch');
        return Response.json(written);
    };

    const readEntries = (group: SharedGroup, url: URL): Response => {
        const after = Number(url.searchParams.get('after') ?? 0);
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), options.pageSize ?? 200);
        const until = leftSeq.get(group.id) ?? Infinity;
        const changes = rows
            .filter((row) => row.groupId === group.id && row.seq > after && row.seq <= until)
            .sort((a, b) => a.seq - b.seq);
        const page = changes.slice(0, limit);
        return Response.json({
            entries: page.map((row) => row.entry),
            cursor: page.at(-1)?.seq ?? after,
            hasMore: changes.length > page.length,
        });
    };

    // A link serves once: accepted, the test user is in its friend
    const answerLink = (action: LinkAction, init?: RequestInit): Response => {
        const refusal = state.linkRefusals[action];
        if (refusal) return refuse(refusal);
        const link = links.get((json(init) as { token: string }).token);
        if (!link) return refuse({ status: 410, error: 'gone' });
        if (action === 'read') return Response.json({ name: link.name });
        links.delete(link.token);
        if (action === 'decline') return new Response(null, { status: 204 });
        const friend = structuredClone(link.friend);
        groups.push(friend);
        return Response.json(friend);
    };

    // The links to be friends of the test user: a new one comes first, and revoking one takes it out
    const ownLinks = (url: URL, method: string): Response => {
        if (method === 'GET') return Response.json({ invitations: pending });
        groupRequests.push(`${method} ${url.pathname}`);
        if (state.groupRefusal) return refuse(state.groupRefusal);
        if (method === 'POST') {
            const id = crypto.randomUUID();
            const invitation = { id, token: `${id}.${'A'.repeat(43)}`, expiresAt: Date.now() + INVITATION_DAYS * DAY };
            pending.unshift(invitation);
            return Response.json({ invitation });
        }
        const at = pending.findIndex((link) => url.pathname === `/api/invitations/${link.id}`);
        if (at < 0) return refuse({ status: 404, error: 'not-found' });
        pending.splice(at, 1);
        return Response.json({ invitations: pending });
    };

    // Answers a request under /api/groups or /api/invitations
    const handle = (url: URL, method: string, init?: RequestInit): Response => {
        if (url.pathname === '/api/groups' && method === 'GET') return Response.json({ groups });

        const ofLinks = url.pathname === '/api/invitations' && (method === 'GET' || method === 'POST');
        if (ofLinks || (method === 'DELETE' && url.pathname.startsWith('/api/invitations/'))) {
            return ownLinks(url, method);
        }

        const action = /^\/api\/invitations\/(read|accept|decline)$/.exec(url.pathname)?.[1] as LinkAction | undefined;
        if (action && method === 'POST') return answerLink(action, init);

        const [, groupId = '', rest = ''] = /^\/api\/groups\/([^/]+)(.*)$/.exec(url.pathname) ?? [];
        const group = groupOf(groupId);

        if (rest === '/entries' && method === 'GET') return group ? readEntries(group, url) : refuse({ status: 404 });
        const entryId = /^\/entries\/([^/]+)$/.exec(rest)?.[1];
        if (entryId && method === 'PUT') return group ? writeEntry(group, entryId, init) : refuse({ status: 404 });

        groupRequests.push(`${method} ${url.pathname}`);
        if (state.groupRefusal) return refuse(state.groupRefusal);
        if (!group) {
            const made = rest === '' && method === 'PUT' ? newGroup(groupId, json(init)) : { status: 404 };
            return 'status' in made ? refuse(made) : Response.json(made);
        }
        const refusal = changeGroup(group, rest, method, init);
        return refusal ? refuse(refusal) : Response.json(group);
    };

    return {
        handle,
        groups,
        groupRequests,
        entryAttempts,
        entryWrites,
        // The entries of a group as the server holds them, oldest change first
        entriesOf: (groupId: string) =>
            rows
                .filter((row) => row.groupId === groupId)
                .sort((a, b) => a.seq - b.seq)
                .map((row) => row.entry),
        cursorOf,
        pendingInvitations: pending,
        // Another member writes an entry, from their own device
        serverWriteEntry: ({ groupId, ...entry }: SeededEntry, by: string) =>
            storeEntry(groupId, { ...entry, createdBy: by, updatedBy: by }),
    };
};

export {
    createFakeGroups,
    type FakeGroupsOptions,
    type FakeGroupsState,
    type IncomingInvitation,
    type Refusal,
    type SeededEntry,
};
