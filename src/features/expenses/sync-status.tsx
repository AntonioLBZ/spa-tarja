import { useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { useOnline, useOutbox } from '@/lib/offline';

import './sync-status.css';

const SyncStatus = () => {
    const t = useTranslations('sync');
    const outbox = useOutbox();
    const { pending, rejected } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const online = useOnline();

    if (online && pending.length === 0 && rejected === 0) return null;

    return (
        <div className="sync-status">
            {!online && <Notice tone="quiet">{t('offline')}</Notice>}
            {pending.length > 0 && <Notice tone="quiet">{t('pending', { count: pending.length })}</Notice>}
            {rejected > 0 && (
                <div className="sync-status__rejected">
                    <Notice tone="danger" role="alert" className="sync-status__message">
                        {t('rejected', { count: rejected })}
                    </Notice>
                    <Button onClick={outbox.dismissRejected}>{t('dismiss')}</Button>
                </div>
            )}
        </div>
    );
};

export { SyncStatus };
