import { env } from 'cloudflare:workers';

import { send } from '@server/testing/groups';
import { type TestSession } from '@server/testing/session';

const trip = (overrides: Record<string, unknown> = {}) => {
    return {
        kind: 'group',
        name: 'Trip to Lisbon',
        currency: 'EUR',
        me: { id: crypto.randomUUID() },
        others: [
            { id: crypto.randomUUID(), name: 'Bruno' },
            { id: crypto.randomUUID(), name: 'Carla' },
        ],
        ...overrides,
    };
};

const put = (as: TestSession, id: string, body: unknown) => {
    return send(as, 'PUT', `/groups/${id}`, body);
};

const handOver = (as: TestSession, id: string, memberId: string) => {
    return send(as, 'POST', `/groups/${id}/owner`, { memberId });
};

const switches = (as: TestSession, id: string, body: unknown) => {
    return send(as, 'PUT', `/groups/${id}/me`, body);
};

const remove = (as: TestSession, id: string) => {
    return send(as, 'DELETE', `/groups/${id}`);
};

const rows = async (table: string, groupId: string) => {
    const column = table === 'shared_groups' ? 'id' : 'group_id';
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?1`).bind(groupId).first();
    return row?.n;
};

const standing = async (memberId: string) => {
    const row = await env.DB.prepare('SELECT role, left_at IS NOT NULL AS left FROM shared_members WHERE id = ?1')
        .bind(memberId)
        .first<{ role: string; left: number }>();
    return { role: row?.role, left: row?.left === 1 };
};

export { handOver, put, remove, rows, standing, switches, trip };
