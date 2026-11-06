import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { CONTACT_EMAIL, CONTACT_MAILTO, PORTFOLIO_URL } from '@/lib/contact';

import './privacy-notice.css';

// The button and the notice it opens. The text is in the bundle, so it can be read before signing in and offline.
const PrivacyNotice = () => {
    const t = useTranslations('privacy');
    const settings = useTranslations('settings');
    const [open, setOpen] = useState(false);

    // The controls the notice points at, by the names they have in the settings
    const controls = {
        settings: settings('title'),
        data: settings('data.title'),
        profile: settings('profile.title'),
        delete: settings('account.delete.open'),
    };

    const actions = (
        <Button ghost onClick={() => setOpen(false)}>
            {t('close')}
        </Button>
    );

    return (
        <>
            <Button ghost onClick={() => setOpen(true)}>
                {t('open')}
            </Button>
            <Dialog open={open} title={t('title')} actions={actions} onClose={() => setOpen(false)}>
                <p>{t('intro')}</p>
                <section className="privacy-notice__section">
                    <h3 className="privacy-notice__heading">{t('who.title')}</h3>
                    <p>{t('who.text')}</p>
                    <div className="privacy-notice__links">
                        <a className="button button--ghost" href={CONTACT_MAILTO}>
                            {CONTACT_EMAIL}
                        </a>
                        <a
                            className="button button--ghost"
                            href={PORTFOLIO_URL}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            {t('who.portfolio')}
                        </a>
                    </div>
                </section>
                <section className="privacy-notice__section">
                    <h3 className="privacy-notice__heading">{t('stored.title')}</h3>
                    <p>{t('stored.intro')}</p>
                    <ul className="privacy-notice__list">
                        <li>{t('stored.google')}</li>
                        <li>{t('stored.nickname')}</li>
                        <li>{t('stored.written')}</li>
                        <li>{t('stored.invitations')}</li>
                        <li>{t('stored.sessions')}</li>
                        <li>{t('stored.device')}</li>
                    </ul>
                </section>
                <section className="privacy-notice__section">
                    <h3 className="privacy-notice__heading">{t('sees.title')}</h3>
                    <p>{t('sees.members')}</p>
                    <p>{t('sees.own')}</p>
                </section>
                <section className="privacy-notice__section">
                    <h3 className="privacy-notice__heading">{t('others.title')}</h3>
                    <p>{t('others.cloudflare')}</p>
                    <p>{t('others.google')}</p>
                    <p>{t('others.none')}</p>
                </section>
                <section className="privacy-notice__section">
                    <h3 className="privacy-notice__heading">{t('keeps.title')}</h3>
                    <p>{t('keeps.how')}</p>
                    <p>{t('keeps.goes')}</p>
                    <p>{t('keeps.stays')}</p>
                    <p>{t('keeps.backups')}</p>
                </section>
                <section className="privacy-notice__section">
                    <h3 className="privacy-notice__heading">{t('rights.title')}</h3>
                    <ul className="privacy-notice__list">
                        <li>{t('rights.see', controls)}</li>
                        <li>{t('rights.correct', controls)}</li>
                        <li>{t('rights.delete', controls)}</li>
                        <li>{t('rights.write')}</li>
                    </ul>
                    <p>{t('rights.complaint')}</p>
                </section>
                <p className="privacy-notice__updated">{t('updated')}</p>
            </Dialog>
        </>
    );
};

export { PrivacyNotice };
