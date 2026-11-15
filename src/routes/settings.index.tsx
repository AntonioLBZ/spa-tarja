import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

import { Card } from '@/components/card/card';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Icon } from '@/components/icon/icon';
import { About } from '@/features/about/about';
import { NotificationsSection } from '@/features/notifications/notifications-section';
import { profileQuery } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { LOCALES, LOCALE_NAMES, useLocale } from '@/lib/i18n';
import { personName } from '@core/shared-group';

import './settings.css';

interface SettingsCardProps {
    to: '/settings/appearance' | '/settings/categories' | '/settings/account';
    title: string;
    // What the page holds, said under the card and outside it
    hint: string;
}

// A card that leads to a page of the settings: its title and a chevron on one line, the link covering it, and under
// it the hint that describes the link
const SettingsCard = (props: SettingsCardProps) => {
    const { to, title, hint } = props;
    const hintId = useId();

    return (
        <li className="settings__item">
            <Card className="settings__card">
                <Link className="settings__card-link" to={to} aria-describedby={hintId}>
                    <span className="settings__card-title">{title}</span>
                    <Icon name="chevron_right" />
                </Link>
            </Card>
            <p className="settings__card-hint" id={hintId}>
                {hint}
            </p>
        </li>
    );
};

// The name the person's friends see, and the email of the account
const AccountCard = () => {
    const t = useTranslations('settings');
    const user = useUser();
    const { data: profile } = useQuery(profileQuery());
    const name = personName({ nickname: profile?.nickname ?? null, name: profile?.name ?? user.name });

    return (
        <SettingsCard
            to="/settings/account"
            title={t('account.title')}
            hint={t('account.hint', { name, email: user.email })}
        />
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
            <ul className="settings__cards">
                <SettingsCard to="/settings/appearance" title={t('appearance.title')} hint={t('appearance.hint')} />
                <SettingsCard to="/settings/categories" title={t('categories.title')} hint={t('categories.hint')} />
                <AccountCard />
            </ul>
            <NotificationsSection />
            <About />
        </section>
    );
};

export const Route = createFileRoute('/settings/')({ component: Settings });
