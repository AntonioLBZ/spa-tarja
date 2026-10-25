import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { useOutbox } from '@/lib/offline';

import './sync-status.css';

function subscribeOnline(listener: () => void) {
    return onlineManager.subscribe(listener);
}

function isOnline() {
    return onlineManager.isOnline();
}

function SyncStatus() {
    const t = useTranslations('sync');
    const outbox = useOutbox();
    const { pending, rejected } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const online = useSyncExternalStore(subscribeOnline, isOnline);

    if (online && pending.length === 0 && rejected === 0) return null;

    return (
        <div className="sync-status">
            {!online && <p className="sync-status__line">{t('offline')}</p>}
            {pending.length > 0 && <p className="sync-status__line">{t('pending', { count: pending.length })}</p>}
            {rejected > 0 && (
                <div className="sync-status__rejected">
                    <p className="sync-status__line" role="alert">
                        {t('rejected', { count: rejected })}
                    </p>
                    <button type="button" onClick={outbox.dismissRejected}>
                        {t('dismiss')}
                    </button>
                </div>
            )}
        </div>
    );
}

export { SyncStatus };
