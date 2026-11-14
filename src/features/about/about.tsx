import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { Card, CardList } from '@/components/card/card';
import { PrivacyNotice } from '@/features/auth/privacy-notice';
import { healthQuery } from '@/lib/api';
import { appVersion } from '@/lib/version';

import './about.css';

// The version of the build, whether the API and its database answer, and the privacy notice
const About = () => {
    const t = useTranslations('settings.about');
    const health = useQuery(healthQuery());
    const state = health.isPending ? 'pending' : health.data?.ok ? 'ok' : 'error';
    const statusClsx = clsx('about__status', { 'about__status--error': state === 'error' });

    return (
        <section className="about">
            <h2 className="about__title">{t('title')}</h2>
            <CardList as="dl">
                <Card className="about__row">
                    <dt>{t('version')}</dt>
                    <dd className="about__value">{appVersion()}</dd>
                </Card>
                <Card className="about__row">
                    <dt>{t('status.label')}</dt>
                    <dd className="about__value">
                        <span className={statusClsx} role="status">
                            {t(`status.${state}`)}
                        </span>
                    </dd>
                </Card>
            </CardList>
            <PrivacyNotice />
        </section>
    );
};

export { About };
