import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { GROUPS_KEY } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { refreshPush } from '@/lib/push';

// What the service worker tells the page: a push came in while it is in sight, or a notification was tapped
type WorkerMessage = { type: 'sync' } | { type: 'open'; path: string };

// A path of the app: `//host` would name another site
const isAppPath = (path: unknown): path is string =>
    typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');

const isWorkerMessage = (data: unknown): data is WorkerMessage => {
    if (typeof data !== 'object' || data === null || !('type' in data)) return false;
    if (data.type === 'sync') return true;
    return data.type === 'open' && 'path' in data && isAppPath(data.path);
};

// Keeps the push of this device in step with the page (ADR-0025): a push asks the groups again, so the watcher pulls
// what moved and the banner tells it; a tap on a notification opens its group; and the subscription is sent again when
// the app opens and when the language changes
const PushSync = () => {
    const client = useQueryClient();
    const router = useRouter();
    const { locale } = useLocale();

    useEffect(() => {
        void refreshPush(locale).catch(() => undefined);
    }, [locale]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        const worker = navigator.serviceWorker;
        const onMessage = (event: MessageEvent) => {
            if (!isWorkerMessage(event.data)) return;
            if (event.data.type === 'sync') void client.invalidateQueries({ queryKey: GROUPS_KEY });
            else void router.navigate({ href: event.data.path });
        };
        worker.addEventListener('message', onMessage);
        return () => worker.removeEventListener('message', onMessage);
    }, [client, router]);

    return null;
};

export { PushSync };
