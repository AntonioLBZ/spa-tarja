import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Icon } from '@/components/icon/icon';
import { About } from '@/features/about/about';
import { NotificationsSection } from '@/features/notifications/notifications-section';
import { profileQuery } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { LOCALES, LOCALE_NAMES, useLocale } from '@/lib/i18n';
import { personName } from '@core/shared-group';

import './settings.css';

interface SettingsRowProps {
    to: '/settings/appearance' | '/settings/categories' | '/settings/account';
    title: string;
    // What the page holds, said under the row
    hint: string;
}

// A row that leads to a page of the settings: its title and a chevron on one line over a hairline, the link covering
// it, and under the hairline the hint that describes the link
const SettingsRow = (props: SettingsRowProps) => {
    const { to, title, hint } = props;
    const hintId = useId();

    return (
        <li className="settings__item">
            <Link className="settings__row" to={to} aria-describedby={hintId}>
                <span className="settings__row-title">{title}</span>
                <Icon name="chevron_right" />
            </Link>
            <p className="settings__row-hint" id={hintId}>
                {hint}
            </p>
        </li>
    );
};

// The name the person's friends see, and the email of the account
const AccountRow = () => {
    const t = useTranslations('settings');
    const user = useUser();
    const { data: profile } = useQuery(profileQuery());
    const name = personName({ nickname: profile?.nickname ?? null, name: profile?.name ?? user.name });

    return (
        <SettingsRow
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
            <ul className="settings__rows">
                <SettingsRow to="/settings/appearance" title={t('appearance.title')} hint={t('appearance.hint')} />
                <SettingsRow to="/settings/categories" title={t('categories.title')} hint={t('categories.hint')} />
                <AccountRow />
            </ul>
            <NotificationsSection />
            <About />
        </section>
    );
};

export const Route = createFileRoute('/settings/')({ component: Settings });
