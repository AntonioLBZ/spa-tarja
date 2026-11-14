import { createTranslator } from 'use-intl';
import { describe, expect, it } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';

import { wordNotices, type NoticeContext } from './notice-words';

import type { Notice } from '@core/notices';

const t = createTranslator({ locale: 'en', messages: en, namespace: 'notices' });

function expense(groupId = 'flat', overrides: Partial<Notice & { kind: 'expense' }> = {}): Notice {
    return {
        kind: 'expense',
        groupId,
        entryId: crypto.randomUUID(),
        authorId: 'ana',
        text: 'Dinner',
        currency: 'EUR',
        partCents: 625,
        ...overrides,
    };
}

function settlement(side: 'paid-you' | 'you-paid'): Notice {
    return {
        kind: 'settlement',
        groupId: 'flat',
        entryId: crypto.randomUUID(),
        counterpartId: 'ana',
        currency: 'EUR',
        amountCents: 2000,
        side,
    };
}

function context(notice: Notice, groupTitle = 'Flat'): NoticeContext {
    return { notice, groupTitle, actor: 'Ana', amount: notice.kind === 'expense' ? '€6.25' : '€20.00' };
}

describe('wordNotices', () => {
    it('names the group and what the author added, with the part of the person', () => {
        expect(wordNotices(t, [context(expense())])).toEqual({
            title: 'Flat',
            message: 'Ana added Dinner · your part €6.25',
            path: '/groups/flat',
        });
    });

    it('names a friend by the friend', () => {
        expect(wordNotices(t, [context(expense(), 'Ana')]).title).toBe('Ana');
    });

    it('says an expense without a text is an expense', () => {
        expect(wordNotices(t, [context(expense('flat', { text: '' }))]).message).toBe(
            'Ana added an expense · your part €6.25'
        );
    });

    it('says who paid the person', () => {
        expect(wordNotices(t, [context(settlement('paid-you'))]).message).toBe('Ana paid you €20.00');
    });

    it('says who noted that the person paid them', () => {
        expect(wordNotices(t, [context(settlement('you-paid'))]).message).toBe('Ana noted you paid them €20.00');
    });

    it('counts several expenses of one group', () => {
        expect(wordNotices(t, [context(expense()), context(expense()), context(expense())])).toEqual({
            title: 'Flat',
            message: '3 new expenses',
            path: '/groups/flat',
        });
    });

    it('counts several entries of one group when one is a settlement', () => {
        expect(wordNotices(t, [context(expense()), context(settlement('paid-you'))]).message).toBe('2 new entries');
    });

    it('counts the entries of several groups and leads to the groups', () => {
        const notices = [context(expense()), context(expense('trip'), 'Trip'), context(expense('trip'), 'Trip')];

        expect(wordNotices(t, notices)).toEqual({
            title: 'Groups',
            message: '3 new entries in 2 groups',
            path: '/groups',
        });
    });

    it('reads naturally in Spanish', () => {
        const tEs = createTranslator({ locale: 'es', messages: es, namespace: 'notices' });

        expect(wordNotices(tEs, [context(expense())]).message).toBe('Ana añadió Dinner · tu parte €6.25');
        expect(wordNotices(tEs, [context(expense()), context(expense())]).message).toBe('2 gastos nuevos');
    });
});
