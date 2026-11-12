import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';

import { Page } from './page';

// An address that leads nowhere: it says so and leads home, inside the same page as every other screen
const NotFound = () => {
    const t = useTranslations('nav.notFound');

    return (
        <Page title={t('title')}>
            <p>{t('text')}</p>
            <ButtonLink variant="primary" to="/">
                {t('home')}
            </ButtonLink>
        </Page>
    );
};

export { NotFound };
