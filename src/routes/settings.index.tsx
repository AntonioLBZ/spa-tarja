import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Card, CardList } from '@/components/card/card';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Icon } from '@/components/icon/icon';
import { About } from '@/features/about/about';
import { NotificationsSection } from '@/features/notifications/notifications-section';
import { profileQuery } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { LOCALES, LOCALE_NAMES, useLocale } from '@/lib/i18n';
import { personName } from '@core/shared-group';

import type { ReactNode } from 'react';

import './settings.css';

interface SettingsCardProps {
    to: '/settings/appearance' | '/settings/categories' | '/settings/account';
    title: string;
    children?: ReactNode;
}

// A card that leads to a page of the settings: the link covers it, the chevron ends it
const SettingsCard = (props: SettingsCardProps) => {
    const { to, title, children } = props;

    return (
        <Card as="li" className="settings__card">
            <Link className="settings__card-link" to={to}>
                <span className="settings__card-body">
                    <span>{title}</span>
                    {children && <span className="settings__card-detail">{children}</span>}
                </span>
                <Icon name="chevron_right" />
            </Link>
        </Card>
    );
};

// The name the person's friends see, and the email of the account
const AccountCard = () => {
    const t = useTranslations('settings');
    const user = useUser();
    const { data: profile } = useQuery(profileQuery());

    return (
        <SettingsCard to="/settings/account" title={t('account.title')}>
            <span>{personName({ nickname: profile?.nickname ?? null, name: profile?.name ?? user.name })}</span>
            <span>{user.email}</span>
        </SettingsCard>
    );
};

// The language, the pages of the settings, the notifications and what the app is (ADR-0032)
const Settings = () => {
    const t = useTranslations('settings');
    const { locale, setLocale } = useLocale();

    return (
        <section className="settings">
            <h1 className="settings__title">{t('title')}</h1>
            <ChoiceGroup
                legend={t('language.title')}
                name="locale"
                options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
                value={locale}
                onChange={setLocale}
            />
            <CardList>
                <SettingsCard to="/settings/appearance" title={t('appearance.title')} />
                <SettingsCard to="/settings/categories" title={t('categories.title')} />
                <AccountCard />
            </CardList>
            <NotificationsSection />
            <About />
        </section>
    );
};

export const Route = createFileRoute('/settings/')({ component: Settings });
