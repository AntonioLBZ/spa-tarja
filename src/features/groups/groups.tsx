import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';

import './groups.css';

const Groups = () => {
    const t = useTranslations('groups');

    return (
        <section className="groups">
            <h1 className="groups__title">{t('title')}</h1>
            <Notice tone="quiet">{t('soon')}</Notice>
        </section>
    );
};

export { Groups };
