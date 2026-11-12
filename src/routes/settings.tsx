import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Account } from '@/features/auth/account';
import { YourData } from '@/features/export/your-data';
import { Profile } from '@/features/profile/profile';
import { Page } from '@/features/shell/page';
import { ACCENTS, useAccent } from '@/lib/accent';
import { LOCALES, LOCALE_NAMES, useLocale } from '@/lib/i18n';
import { THEMES, useTheme } from '@/lib/theme';

import './settings.css';

const Settings = () => {
    const t = useTranslations('settings');
    const { locale, setLocale } = useLocale();
    const { theme, setTheme } = useTheme();
    const { accent, setAccent } = useAccent();

    return (
        <Page title={t('title')}>
            <div className="settings">
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
                <ChoiceGroup
                    swatch
                    legend={t('accent.title')}
                    name="accent"
                    options={ACCENTS.map((value) => ({
                        value,
                        label: t(`accent.${value}`),
                        content: <span className="settings__dot" data-accent={value} />,
                    }))}
                    value={accent}
                    onChange={setAccent}
                />
                <Profile />
                <section className="settings__section">
                    <h2 className="settings__heading">{t('categories.title')}</h2>
                    <p className="settings__hint">{t('categories.description')}</p>
                    <ButtonLink block to="/categories">
                        {t('categories.link')}
                    </ButtonLink>
                </section>
                <YourData />
                <Account />
            </div>
        </Page>
    );
};

export const Route = createFileRoute('/settings')({ component: Settings });
