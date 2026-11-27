import { env } from 'cloudflare:workers';
import { expect } from 'vitest';

import { type LedgerEntry } from '@core/groups/shared-entry';
import { send } from '@server/testing/groups';
import { type TestSession } from '@server/testing/session';

import type { SharedGroup } from '@core/groups/shared-group';

const dinner = (paidBy: string, shares: Record<string, number>, overrides: Record<string, unknown> = {}) => {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-10-25',
        paidBy,
        split: 'exact',
        shares: list,
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
};

const settlement = (paidBy: string, to: string, cents: number, overrides: Record<string, unknown> = {}) => {
    return {
        kind: 'settlement',
        text: '',
        amountCents: cents,
        currency: 'EUR',
        date: '2026-10-26',
        paidBy,
        shares: [{ memberId: to, cents }],
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
};

const putEntry = (as: TestSession, groupId: string, id: string, body: unknown) => {
    return send(as, 'PUT', `/groups/${groupId}/entries/${id}`, body);
};

const entryOf = async (response: Response) => {
    expect(response.status).toBe(200);
    return (await response.json()) as LedgerEntry;
};

const error = async (response: Response, status: number) => {
    expect(response.status).toBe(status);
    return ((await response.json()) as { error: string }).error;
};

const stored = async (id: string) => {
    return env.DB.prepare('SELECT group_id, text, updated_at, deleted_at, seq FROM shared_entries WHERE id = ?1')
        .bind(id)
        .first<{ group_id: string; text: string; updated_at: number; deleted_at: number | null; seq: number }>();
};

const seqsOf = async (groupId: string) => {
    const { results } = await env.DB.prepare('SELECT seq FROM shared_entries WHERE group_id = ?1 ORDER BY seq')
        .bind(groupId)
        .all<{ seq: number }>();
    return results.map((row) => row.seq);
};

const removeMember = (as: TestSession, group: SharedGroup, memberId: string) => {
    return send(as, 'DELETE', `/groups/${group.id}/members/${memberId}`);
};

const list = (as: TestSession, groupId: string, query = '') => {
    return send(as, 'GET', `/groups/${groupId}/entries${query}`);
};

const changes = async (as: TestSession, groupId: string, query = '') => {
    const response = await list(as, groupId, query);
    expect(response.status).toBe(200);
    return (await response.json()) as { entries: LedgerEntry[]; cursor: number; hasMore: boolean };
};

export { changes, dinner, entryOf, error, list, putEntry, removeMember, seqsOf, settlement, stored };
