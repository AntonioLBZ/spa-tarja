import { deletePush, fetchPushKey, putPush } from '@/lib/api';

import type { PushLocale, PushSubscriptionInput } from '@core/push';

// Where this browser stands with push: without it, blocked, never asked, or allowed
type PushPermission = 'unsupported' | 'denied' | 'default' | 'granted';

const pushPermission = (): PushPermission => {
    if (typeof window === 'undefined' || !('PushManager' in window) || !('Notification' in window)) {
        return 'unsupported';
    }
    if (!('serviceWorker' in navigator)) return 'unsupported';
    return Notification.permission;
};

const pushManager = async (): Promise<PushManager | null> => {
    if (pushPermission() === 'unsupported') return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.pushManager ?? null;
};

// The subscription of this browser, if it has one
const readPushSubscription = async (): Promise<PushSubscription | null> => {
    return (await (await pushManager())?.getSubscription()) ?? null;
};

const subscriptionInput = (subscription: PushSubscription, locale: PushLocale): PushSubscriptionInput => {
    const { endpoint, keys } = subscription.toJSON();
    return { endpoint: endpoint ?? '', keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' }, locale };
};

// Asks the browser's permission, subscribes with the key of the server and hands the subscription to the server.
// Answers the permission the browser has afterwards.
const turnPushOn = async (locale: PushLocale): Promise<PushPermission> => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission;
    const manager = await pushManager();
    if (!manager) return 'unsupported';
    const subscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: await fetchPushKey() });
    await putPush(subscriptionInput(subscription, locale));
    return permission;
};

// Takes the subscription away from the server, then from the browser
const turnPushOff = async (): Promise<void> => {
    const subscription = await readPushSubscription();
    if (!subscription) return;
    await deletePush(subscription.endpoint);
    await subscription.unsubscribe();
};

// Sends the subscription of this browser again, so the server holds its current address and language
const refreshPush = async (locale: PushLocale): Promise<void> => {
    const subscription = await readPushSubscription();
    if (subscription) await putPush(subscriptionInput(subscription, locale));
};

// Takes the subscription away from the browser alone, when the person is signed out
const forgetPushInBrowser = async (): Promise<void> => {
    await (await readPushSubscription())?.unsubscribe();
};

export {
    forgetPushInBrowser,
    pushPermission,
    readPushSubscription,
    refreshPush,
    turnPushOff,
    turnPushOn,
    type PushPermission,
};
