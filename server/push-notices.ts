import { noticeOf, type Notice } from '@core/notices';
import { UNNAMED_PERSON } from '@core/shared-group';
import { canonicalMember } from '@core/shared-member';
import { deletePushSubscription, listPushSubscriptions } from '@server/db/push';
import { readVapidKey } from '@server/vapid';
import { sendPush } from '@server/web-push';

import type { PushLocale } from '@core/push';
import type { LedgerEntry } from '@core/shared-entry';
import type { GroupState } from '@server/db/groups';
import type { AppEnv } from '@server/env';

// What the service worker gets, which it words in the language of the device (ADR-0025)
interface PushMessage {
    locale: PushLocale;
    groupId: string;
    // What the person calls the group: its name, or the other person for a friend
    groupTitle: string;
    // The author of an expense, or the other side of a settlement, as the group names them
    actor: string;
    notice: Notice;
}

// A push service takes 4 KB; a text is cut well under it
const TEXT_MAX_LENGTH = 200;

const cut = (text: string) => (text.length > TEXT_MAX_LENGTH ? `${text.slice(0, TEXT_MAX_LENGTH - 1)}…` : text);

// The name a member has for a person who sees the group: a friend that is open shows the other side by their nickname
const nameIn = ({ group, members }: GroupState, memberId: string | null): string => {
    const id = memberId && canonicalMember(members, memberId);
    const member = members.find((candidate) => candidate.id === id);
    if (!member) return UNNAMED_PERSON;
    const live = group.kind === 'direct' && group.deletedAt === null;
    return (live ? (member.nickname ?? member.name) : member.name) || UNNAMED_PERSON;
};

const messageFor = (state: GroupState, recipient: string, notice: Notice, locale: PushLocale): PushMessage => {
    const other = state.members.find((member) => member.id !== recipient && member.userId !== null);
    const groupTitle = state.group.kind === 'direct' ? nameIn(state, other?.id ?? null) : (state.group.name ?? '');
    const actor = nameIn(state, notice.kind === 'expense' ? notice.authorId : notice.counterpartId);
    const told = notice.kind === 'expense' ? { ...notice, text: cut(notice.text) } : notice;
    return { locale, groupId: state.group.id, groupTitle: cut(groupTitle), actor: cut(actor), notice: told };
};

// Pushes a new entry to every member it concerns who uses the app and hasn't left, but its author, on each of their
// devices; a subscription its push service says is gone is deleted. Nothing is sent without the key of the server.
const notifyEntry = async (env: AppEnv['Bindings'], state: GroupState, entry: LedgerEntry): Promise<void> => {
    const key = readVapidKey(env.VAPID_PRIVATE_KEY);
    if (!key) return;
    const recipients = state.members.flatMap((member) => {
        if (member.userId === null || member.leftAt !== null || member.id === state.me.id) return [];
        const notice = noticeOf(state.members, state.group.id, entry, member.id);
        return notice ? [{ member, notice }] : [];
    });
    const byUser = new Map(recipients.map((recipient) => [recipient.member.userId ?? '', recipient]));
    const subscriptions = await listPushSubscriptions(env.DB, [...byUser.keys()]);
    await Promise.all(
        subscriptions.map(async (subscription) => {
            const recipient = byUser.get(subscription.userId);
            if (!recipient) return;
            const message = messageFor(state, recipient.member.id, recipient.notice, subscription.locale);
            const result = await sendPush(subscription, message, key, env.VAPID_SUBJECT ?? '');
            if (result === 'gone') await deletePushSubscription(env.DB, subscription.endpoint);
        })
    );
};

export { notifyEntry, type PushMessage };
