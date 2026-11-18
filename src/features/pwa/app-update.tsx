import { useEffect } from 'react';
import { useTranslations } from 'use-intl';

import { useToast } from '@/components/toast/toast';

import { appUpdate, useAppUpdateState } from './app-update-state';

// Offers the new version of the app as soon as the service worker finds it: a pinned toast, which stays until the
// person answers it or swipes it away, and offers Update once the new version has downloaded
const AppUpdate = () => {
    const t = useTranslations('pwa.update');
    const toast = useToast();
    const state = useAppUpdateState();
    const downloading = t('downloading');
    const message = t('message');
    const apply = t('apply');
    const dismiss = t('dismiss');

    useEffect(() => {
        if (state === 'none') {
            toast.unpin();
            return;
        }
        const later = { label: dismiss, onAction: appUpdate.postpone };
        if (state === 'downloading') {
            toast.pin({ message: downloading, actions: [later], onSwipeAway: appUpdate.postpone });
            return;
        }
        toast.pin({
            message,
            actions: [{ label: apply, onAction: appUpdate.apply }, later],
            onSwipeAway: appUpdate.postpone,
        });
    }, [state, toast, downloading, message, apply, dismiss]);

    // The offer is the app's, so it goes with it
    useEffect(() => toast.unpin, [toast]);

    return null;
};

export { AppUpdate };
