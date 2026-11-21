import { useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { useOnline, useOutbox } from '@/lib/offline';

import './sync-status.css';

const SyncStatus = () => {
    const t = useTranslations('sync');
    const outbox = useOutbox();
    const { pending, rejected } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const online = useOnline();

    return (
        <div className="sync-status">
            <LiveNotice tone="quiet">{!online && t('offline')}</LiveNotice>
            <LiveNotice tone="quiet">{pending.length > 0 && t('pending', { count: pending.length })}</LiveNotice>
            {rejected.length > 0 && (
                <div className="sync-status__rejected">
                    <Notice tone="danger" role="alert" className="sync-status__message">
                        {t('rejected', { count: rejected.length })}
                    </Notice>
                    <Button onClick={outbox.dismissRejected}>{t('dismiss')}</Button>
                </div>
            )}
        </div>
    );
};

export { SyncStatus };
