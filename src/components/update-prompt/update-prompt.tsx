import { useTranslations } from 'use-intl';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/button/button';

import './update-prompt.css';

function UpdatePrompt() {
    const t = useTranslations('pwa.update');
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh) return null;

    return (
        <div className="update-prompt" role="status">
            <p className="update-prompt__message">{t('message')}</p>
            <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
                {t('apply')}
            </Button>
            <Button onClick={() => setNeedRefresh(false)}>{t('dismiss')}</Button>
        </div>
    );
}

export { UpdatePrompt };
