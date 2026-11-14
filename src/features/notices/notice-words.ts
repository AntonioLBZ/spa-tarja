import type { Notice } from '@core/notices';

type NoticeKey =
    'groupsTitle' | 'expense' | 'untitled' | 'paidYou' | 'youPaid' | 'expenses' | 'entries' | 'entriesInGroups';

// The translator of `notices`, from the app or from the service worker
type NoticeTranslator = (key: NoticeKey, values?: Record<string, string | number>) => string;

// A notice with the words it needs from its group: what the person calls the group, the author of an expense or the other
// side of a settlement, and the person's part or the amount, formatted
interface NoticeContext {
    notice: Notice;
    groupTitle: string;
    actor: string;
    amount: string;
}

interface NoticeWords {
    title: string;
    message: string;
    // Where a tap leads: the group, or the groups when they are several
    path: string;
}

const oneNotice = (t: NoticeTranslator, { notice, actor, amount }: NoticeContext): string => {
    if (notice.kind === 'expense') return t('expense', { actor, text: notice.text || t('untitled'), part: amount });
    return t(notice.side === 'paid-you' ? 'paidYou' : 'youPaid', { actor, amount });
};

// What a banner or a notification says of the notices that came in (ADR-0025)
const wordNotices = (t: NoticeTranslator, contexts: readonly NoticeContext[]): NoticeWords => {
    const [first] = contexts;
    if (!first) throw new Error('Nothing to tell');
    const groups = new Set(contexts.map((context) => context.notice.groupId));
    const count = contexts.length;

    if (groups.size > 1) {
        return {
            title: t('groupsTitle'),
            message: t('entriesInGroups', { count, groups: groups.size }),
            path: '/groups',
        };
    }
    const path = `/groups/${first.notice.groupId}`;
    if (count === 1) return { title: first.groupTitle, message: oneNotice(t, first), path };
    const allExpenses = contexts.every((context) => context.notice.kind === 'expense');
    return { title: first.groupTitle, message: t(allExpenses ? 'expenses' : 'entries', { count }), path };
};

export { wordNotices, type NoticeContext, type NoticeTranslator, type NoticeWords };
