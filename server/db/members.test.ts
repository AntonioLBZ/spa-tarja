import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { addFriend, leaveGroup, mergeMember, reopenMember } from '@server/db/members';
import { makeGroup, memberNamed } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

let ana: TestSession;
let bruno: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
});

async function row(memberId: string) {
    return env.DB.prepare('SELECT left_at, left_seq, merged_into FROM shared_members WHERE id = ?1')
        .bind(memberId)
        .first<{ left_at: number | null; left_seq: number | null; merged_into: string | null }>();
}

describe('leaveGroup', () => {
    it('keeps the moment a member first left', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const dummy = memberNamed(group, 'Bruno');
        await env.DB.prepare('UPDATE shared_members SET left_at = 1, left_seq = 0 WHERE id = ?1').bind(dummy).run();

        await leaveGroup(env.DB, dummy);

        expect(await row(dummy)).toEqual({ left_at: 1, left_seq: 0, merged_into: null });
    });
});

describe('mergeMember', () => {
    it('leaves a placeholder that has left, or was merged, as it was', async () => {
        const group = await makeGroup(ana, ['Bruno', 'Carla']);
        const removed = memberNamed(group, 'Bruno');
        const merged = memberNamed(group, 'Carla');
        await env.DB.prepare('UPDATE shared_members SET left_at = 1, left_seq = 0 WHERE id = ?1').bind(removed).run();
        await mergeMember(env.DB, merged, group.me);
        const before = await row(merged);

        await mergeMember(env.DB, removed, group.me);
        await mergeMember(env.DB, merged, removed);

        expect(await row(removed)).toEqual({ left_at: 1, left_seq: 0, merged_into: null });
        expect(await row(merged)).toEqual(before);
    });
});

describe('addFriend', () => {
    it('adds nothing when the merge of the dummy fails', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const dummy = memberNamed(group, 'Bruno');
        const id = crypto.randomUUID();
        await env.DB.prepare(
            `CREATE TRIGGER refuse_merge BEFORE UPDATE OF merged_into ON shared_members
             BEGIN SELECT RAISE(ABORT, 'refused'); END`
        ).run();

        try {
            const member = { id, groupId: group.id, by: ana.userId, at: Date.now() };
            await expect(addFriend(env.DB, member, { userId: bruno.userId, name: 'Bruno' }, dummy)).rejects.toThrow(
                /refused/
            );
        } finally {
            await env.DB.prepare('DROP TRIGGER refuse_merge').run();
        }

        expect(await row(id)).toBeNull();
        expect(await row(dummy)).toEqual({ left_at: null, left_seq: null, merged_into: null });
    });
});

describe('reopenMember', () => {
    async function leftBruno(dummies: string[] = []) {
        const group = await makeGroup(ana, dummies);
        const id = crypto.randomUUID();
        const member = { id, groupId: group.id, by: ana.userId, at: Date.now() };
        await addFriend(env.DB, member, { userId: bruno.userId, name: 'Bruno' }, null);
        await leaveGroup(env.DB, id);
        return { group, id };
    }

    it('brings back a user who left, and clears what leaving and archiving set', async () => {
        const { id } = await leftBruno();
        await env.DB.prepare('UPDATE shared_members SET archived_at = 5 WHERE id = ?1').bind(id).run();

        expect(await reopenMember(env.DB, id, null, Date.now())).toBe(true);

        expect(await row(id)).toEqual({ left_at: null, left_seq: null, merged_into: null });
        const archived = await env.DB.prepare('SELECT archived_at FROM shared_members WHERE id = ?1').bind(id).first();
        expect(archived?.archived_at).toBeNull();
    });

    it('brings back nobody who is in, a dummy that left or one that was merged', async () => {
        const group = await makeGroup(ana, ['Dani', 'Eva']);
        const [dani, eva] = [memberNamed(group, 'Dani'), memberNamed(group, 'Eva')];
        await env.DB.prepare('UPDATE shared_members SET left_at = 1, left_seq = 0 WHERE id = ?1').bind(dani).run();
        await mergeMember(env.DB, eva, group.me);
        const [before, merged] = [await row(dani), await row(eva)];

        expect(await reopenMember(env.DB, group.me, null, Date.now())).toBe(false);
        expect(await reopenMember(env.DB, dani, null, Date.now())).toBe(false);
        expect(await reopenMember(env.DB, eva, null, Date.now())).toBe(false);

        expect(await row(dani)).toEqual(before);
        expect(await row(eva)).toEqual(merged);
    });

    it('merges the dummy only when the member comes back', async () => {
        const { group, id } = await leftBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        expect(await reopenMember(env.DB, id, dani, Date.now())).toBe(true);
        const other = await makeGroup(ana, ['Eva']);
        const eva = memberNamed(other, 'Eva');

        expect(await reopenMember(env.DB, id, eva, Date.now())).toBe(false);

        expect(await row(dani)).toMatchObject({ merged_into: id });
        expect(await row(eva)).toEqual({ left_at: null, left_seq: null, merged_into: null });
    });

    it('brings back nobody and merges nothing when a statement of the batch fails', async () => {
        const { group, id } = await leftBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const left = await row(id);
        await env.DB.prepare(
            `CREATE TRIGGER refuse_reopen BEFORE UPDATE OF archived_at ON shared_members
             BEGIN SELECT RAISE(ABORT, 'refused'); END`
        ).run();

        try {
            await expect(reopenMember(env.DB, id, dani, Date.now())).rejects.toThrow(/refused/);
        } finally {
            await env.DB.prepare('DROP TRIGGER refuse_reopen').run();
        }

        expect(await row(id)).toEqual(left);
        expect(await row(dani)).toEqual({ left_at: null, left_seq: null, merged_into: null });
    });
});
