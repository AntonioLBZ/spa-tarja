import { useTranslations } from 'use-intl';
import { useRegisterSW } from 'virtual:pwa-register/react';

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
            <button className="update-prompt__action" type="button" onClick={() => void updateServiceWorker(true)}>
                {t('apply')}
            </button>
            <button className="update-prompt__action" type="button" onClick={() => setNeedRefresh(false)}>
                {t('dismiss')}
            </button>
        </div>
    );
}

export { UpdatePrompt };
