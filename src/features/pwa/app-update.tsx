import { useTranslations } from 'use-intl';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { UpdatePrompt } from './update-prompt';

// Offers the new version of the app once the service worker has it waiting
function AppUpdate() {
    const t = useTranslations('pwa.update');
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh) return null;

    return (
        <UpdatePrompt
            message={t('message')}
            labels={{ apply: t('apply'), dismiss: t('dismiss') }}
            onApply={() => void updateServiceWorker(true)}
            onDismiss={() => setNeedRefresh(false)}
        />
    );
}

export { AppUpdate };
