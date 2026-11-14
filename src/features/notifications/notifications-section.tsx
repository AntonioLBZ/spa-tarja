import { useTranslations } from 'use-intl';

import { Checkbox } from '@/components/checkbox/checkbox';
import { Notice } from '@/components/notice/notice';
import { useOnline } from '@/lib/offline';

import { usePush } from './use-push';

import './notifications-section.css';

// The switch of push notifications on this device (ADR-0025); turning it on or off needs a connection
const NotificationsSection = () => {
    const t = useTranslations('settings.notifications');
    const online = useOnline();
    const { state, busy, failed, turnOn, turnOff } = usePush();
    const usable = state === 'on' || state === 'off';

    return (
        <section className="notifications-section">
            <h2 className="notifications-section__title">{t('title')}</h2>
            <p className="notifications-section__hint">{t('hint')}</p>
            {state === 'unsupported' && <Notice tone="quiet">{t('unsupported')}</Notice>}
            {state === 'denied' && <Notice tone="quiet">{t('denied')}</Notice>}
            {usable && !online && <Notice role="status">{t('offline')}</Notice>}
            <Checkbox
                label={t('toggle')}
                checked={state === 'on'}
                disabled={!usable || !online || busy}
                onChange={(checked) => void (checked ? turnOn() : turnOff())}
            />
            {failed && (
                <Notice tone="danger" role="alert">
                    {t('failed')}
                </Notice>
            )}
        </section>
    );
};

export { NotificationsSection };
