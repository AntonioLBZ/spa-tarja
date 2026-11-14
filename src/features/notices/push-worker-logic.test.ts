import { describe, expect, it } from 'vitest';

import { formatAmount } from '@core/money';

import { notificationFor, showsNotification } from './push-worker-logic';

import type { PushMessage } from '@server/push-notices';

const CHROME =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
const SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const CHROME_ON_IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';

function message(overrides: Partial<PushMessage> = {}): PushMessage {
    return {
        locale: 'en',
        groupId: 'flat',
        groupTitle: 'Flat',
        actor: 'Ana',
        notice: {
            kind: 'expense',
            groupId: 'flat',
            entryId: crypto.randomUUID(),
            authorId: 'ana',
            text: 'Dinner',
            currency: 'EUR',
            partCents: 625,
        },
        ...overrides,
    };
}

describe('showsNotification', () => {
    it('leaves a visible window to tell it, where the browser allows a push without a notification', () => {
        expect(showsNotification(true, CHROME)).toBe(false);
        expect(showsNotification(true, FIREFOX)).toBe(false);
    });

    it('shows one when no window of the app is visible', () => {
        expect(showsNotification(false, CHROME)).toBe(true);
    });

    it('always shows one in the browsers of an iPhone and in Safari, which require it', () => {
        expect(showsNotification(true, SAFARI)).toBe(true);
        expect(showsNotification(true, CHROME_ON_IPHONE)).toBe(true);
    });
});

describe('notificationFor', () => {
    it('words the message in its language, tagged with its group, leading to it', () => {
        expect(notificationFor(message({ locale: 'es' }), [])).toEqual({
            title: 'Flat',
            body: `Ana añadió Dinner · tu parte ${formatAmount(625, 'EUR', 'es')}`,
            tag: 'flat',
            data: { path: '/groups/flat', contexts: [expect.objectContaining({ actor: 'Ana' })] },
        });
    });

    it('sums up with the notification of the same group it replaces', () => {
        const first = notificationFor(message(), []);

        const second = notificationFor(message(), first.data.contexts);

        expect(second.body).toBe('2 new expenses');
        expect(second.data.contexts).toHaveLength(2);
    });
});
