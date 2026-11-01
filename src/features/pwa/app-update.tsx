import { useEffect } from 'react';
import { useTranslations } from 'use-intl';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { useToast } from '@/components/toast/toast';

// Offers the new version of the app once the service worker has it waiting: a pinned toast, which stays until the
// person answers it
const AppUpdate = () => {
    const t = useTranslations('pwa.update');
    const toast = useToast();
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();
    const message = t('message');
    const apply = t('apply');
    const dismiss = t('dismiss');

    useEffect(() => {
        if (!needRefresh) {
            toast.unpin();
            return;
        }
        toast.pin({
            message,
            actions: [
                { label: apply, onAction: () => void updateServiceWorker(true) },
                { label: dismiss, onAction: () => setNeedRefresh(false) },
            ],
        });
    }, [needRefresh, toast, message, apply, dismiss, updateServiceWorker, setNeedRefresh]);

    // The offer is the app's, so it goes with it
    useEffect(() => toast.unpin, [toast]);

    return null;
};

export { AppUpdate };
