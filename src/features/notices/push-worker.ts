// The script the service worker imports for push notifications (ADR-0025), built on its own as a classic script
import { notificationFor, showsNotification } from './push-worker-logic';

import type { NoticeContext } from './notice-words';
import type { PushMessage } from '@server/push-notices';

// The little of the service worker's world this script uses, which the types of a page don't describe
interface WindowClient {
    visibilityState: 'visible' | 'hidden';
    focus: () => Promise<WindowClient>;
    postMessage: (message: unknown) => void;
}

interface ShownNotification {
    data?: { path?: string; contexts?: NoticeContext[] };
    close: () => void;
}

interface ExtendableEvent extends Event {
    waitUntil: (work: Promise<unknown>) => void;
}

interface PushEvent extends ExtendableEvent {
    data: { json: () => unknown } | null;
}

interface NotificationEvent extends ExtendableEvent {
    notification: ShownNotification;
}

interface WorkerScope {
    navigator: { userAgent: string };
    clients: {
        matchAll: (options: { type: 'window'; includeUncontrolled: boolean }) => Promise<WindowClient[]>;
        openWindow: (url: string) => Promise<unknown>;
    };
    registration: {
        getNotifications: (filter: { tag: string }) => Promise<ShownNotification[]>;
        showNotification: (title: string, options: Record<string, unknown>) => Promise<void>;
    };
    addEventListener: (type: string, listener: (event: never) => void) => void;
}

const scope = self as unknown as WorkerScope;

const windows = () => scope.clients.matchAll({ type: 'window', includeUncontrolled: true });

const onPush = async (message: PushMessage) => {
    const visible = (await windows()).filter((client) => client.visibilityState === 'visible');
    // A window in sight syncs at once, and its banner tells what came in
    for (const client of visible) client.postMessage({ type: 'sync' });
    if (!showsNotification(visible.length > 0, scope.navigator.userAgent)) return;
    const [previous] = await scope.registration.getNotifications({ tag: message.groupId });
    const shown = notificationFor(message, previous?.data?.contexts ?? []);
    await scope.registration.showNotification(shown.title, {
        body: shown.body,
        tag: shown.tag,
        data: shown.data,
        icon: '/pwa-192x192.png',
    });
};

// A tap takes a window of the app to the group, or opens one there
const onClick = async (path: string) => {
    const [client] = await windows();
    if (!client) {
        await scope.clients.openWindow(path);
        return;
    }
    client.postMessage({ type: 'open', path });
    await client.focus();
};

scope.addEventListener('push', (event: PushEvent) => {
    const message = event.data?.json() as PushMessage | undefined;
    if (message) event.waitUntil(onPush(message));
});

scope.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    event.waitUntil(onClick(event.notification.data?.path ?? '/'));
});
