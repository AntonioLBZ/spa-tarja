import { createTranslator } from 'use-intl';

import { notices as enNotices } from '@/assets/locales/en.json';
import { notices as esNotices } from '@/assets/locales/es.json';
import { formatAmount } from '@core/money';

import { wordNotices, type NoticeContext } from './notice-words';

import type { PushMessage } from '@server/push-notices';

// Only the copy of the notices, so the script doesn't carry the whole app's
const MESSAGES = { en: { notices: enNotices }, es: { notices: esNotices } };

// A browser that takes away the subscription of a site that gets a push without showing a notification: Safari, and
// every browser of an iPhone, which are all built on it
const isStrictBrowser = (userAgent: string): boolean => {
    return /AppleWebKit/.test(userAgent) && !/Chrome|Chromium|Edg|Android/.test(userAgent);
};

// Whether a push shows a system notification: always, unless a window of the app is in sight to tell it in its banner
// and the browser allows a push without one (ADR-0025)
const showsNotification = (visibleWindow: boolean, userAgent: string): boolean => {
    return !visibleWindow || isStrictBrowser(userAgent);
};

interface ShownNotification {
    title: string;
    body: string;
    // The group, so a later notification of it replaces this one
    tag: string;
    data: { path: string; contexts: NoticeContext[] };
}

// The notification of a push, summed up with what the one of the same group it replaces told
const notificationFor = (message: PushMessage, previous: readonly NoticeContext[]): ShownNotification => {
    const t = createTranslator({ locale: message.locale, messages: MESSAGES[message.locale], namespace: 'notices' });
    const { notice } = message;
    const cents = notice.kind === 'expense' ? notice.partCents : notice.amountCents;
    const context: NoticeContext = {
        notice,
        groupTitle: message.groupTitle,
        actor: message.actor,
        amount: formatAmount(cents, notice.currency, message.locale),
    };
    const contexts = [...previous, context];
    const words = wordNotices(t, contexts);
    return { title: words.title, body: words.message, tag: message.groupId, data: { path: words.path, contexts } };
};

export { notificationFor, showsNotification, type ShownNotification };
