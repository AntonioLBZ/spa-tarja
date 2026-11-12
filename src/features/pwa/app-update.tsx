import { useEffect } from 'react';
import { useTranslations } from 'use-intl';

import { useToast } from '@/components/toast/toast';

import { appUpdate, useAppUpdateWaiting } from './app-update-state';

// Offers the new version of the app once the service worker has it waiting: a pinned toast, which stays until the
// person answers it
const AppUpdate = () => {
    const t = useTranslations('pwa.update');
    const toast = useToast();
    const waiting = useAppUpdateWaiting();
    const message = t('message');
    const apply = t('apply');
    const dismiss = t('dismiss');

    useEffect(() => {
        if (!waiting) {
            toast.unpin();
            return;
        }
        toast.pin({
            message,
            actions: [
                { label: apply, onAction: appUpdate.apply },
                { label: dismiss, onAction: appUpdate.postpone },
            ],
        });
    }, [waiting, toast, message, apply, dismiss]);

    // The offer is the app's, so it goes with it
    useEffect(() => toast.unpin, [toast]);

    return null;
};

export { AppUpdate };
