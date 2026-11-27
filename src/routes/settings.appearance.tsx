import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Checkbox } from '@/components/checkbox/checkbox';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { AmountSettings } from '@/features/amounts/amount-settings';
import { LOCALES, LOCALE_NAMES, useLocale } from '@/lib/i18n';
import { THEMES, TYPEFACES, useTheme, useTypeface } from '@/lib/theme';

import './settings.css';

// The language and how the app looks: the theme, how dark it is, the typeface and how amounts are drawn (ADR-0049)
const Appearance = () => {
    const t = useTranslations('settings');
    const { locale, setLocale } = useLocale();
    const { theme, setTheme, darkTone, setDarkTone } = useTheme();
    const [typeface, setTypeface] = useTypeface();

    return (
        <section className="settings">
            <ScreenTitle>{t('appearance.title')}</ScreenTitle>
            <ChoiceGroup
                legend={t('language.title')}
                name="locale"
                options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
                value={locale}
                onChange={setLocale}
            />
            <div className="settings__theme">
                <ChoiceGroup
                    legend={t('theme.title')}
                    name="theme"
                    options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
                    value={theme}
                    onChange={setTheme}
                />
                <Checkbox
                    label={t('theme.black.label')}
                    hint={t('theme.black.hint')}
                    checked={theme !== 'light' && darkTone === 'black'}
                    disabled={theme === 'light'}
                    onChange={(black) => setDarkTone(black ? 'black' : 'standard')}
                />
            </div>
            <ChoiceGroup
                legend={t('typeface.title')}
                name="typeface"
                options={TYPEFACES.map((value) => ({ value, label: t(`typeface.${value}`) }))}
                value={typeface}
                onChange={setTypeface}
            />
            <AmountSettings />
        </section>
    );
};

export const Route = createFileRoute('/settings/appearance')({ component: Appearance });
