import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { NEW_ADDRESS, NEW_HOST, isOldAddress } from '@/lib/address';

// Tells whoever opens the old address that the app moved. Staying is not remembered: it comes back on the next visit.
const AppMoved = () => {
    const t = useTranslations('pwa.moved');
    const [open, setOpen] = useState(true);

    if (!isOldAddress(window.location.hostname)) return null;

    const actions = (
        <>
            <a className="button button--ghost" href={NEW_ADDRESS}>
                {t('open', { address: NEW_HOST })}
            </a>
            <Button ghost onClick={() => setOpen(false)}>
                {t('stay')}
            </Button>
        </>
    );

    return (
        <Dialog open={open} title={t('title')} actions={actions} onClose={() => setOpen(false)}>
            <p>{t('message', { address: NEW_HOST })}</p>
            <p>{t('reinstall')}</p>
        </Dialog>
    );
};

export { AppMoved };
