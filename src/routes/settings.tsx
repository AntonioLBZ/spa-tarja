import { Link, createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { LOCALES, LOCALE_NAMES, useLocale } from '@/lib/i18n';
import { THEMES, useTheme } from '@/lib/theme';

import './settings.css';

export const Route = createFileRoute('/settings')({ component: Settings });

function Settings() {
    const t = useTranslations('settings');
    const { locale, setLocale } = useLocale();
    const { theme, setTheme } = useTheme();

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
            <ChoiceGroup
                legend={t('theme.title')}
                name="theme"
                options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
                value={theme}
                onChange={setTheme}
            />
            <Link className="settings__link" to="/categories">
                {t('categories')}
            </Link>
        </section>
    );
}
