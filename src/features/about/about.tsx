import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { CardList, CardTerm } from '@/components/card/card';
import { healthQuery } from '@/lib/api';
import { appVersion, DESIGN_SYSTEM_URL, REPOSITORY_URL } from '@/lib/app-info';

import './about.css';

// Whether the API and its database answer, the code of the app, its design system and the version of the build
const About = () => {
    const t = useTranslations('settings.about');
    const health = useQuery(healthQuery());
    const state = health.isPending ? 'pending' : health.data?.ok ? 'ok' : 'error';
    const statusClsx = clsx('about__status', { 'about__status--error': state === 'error' });

    return (
        <section className="about">
            <h2>{t('title')}</h2>
            <CardList as="dl">
                <CardTerm term={t('status.label')}>
                    <span className={statusClsx} role="status">
                        {t(`status.${state}`)}
                    </span>
                </CardTerm>
                <CardTerm term={t('source.label')} className="card--linked">
                    <a href={REPOSITORY_URL} rel="noopener noreferrer" target="_blank">
                        {t('source.value')}
                    </a>
                </CardTerm>
                <CardTerm term={t('designSystem.label')} className="card--linked">
                    <a href={DESIGN_SYSTEM_URL} rel="noopener noreferrer" target="_blank">
                        {t('designSystem.value')}
                    </a>
                </CardTerm>
                <CardTerm term={t('version')}>{appVersion()}</CardTerm>
            </CardList>
        </section>
    );
};

export { About };
