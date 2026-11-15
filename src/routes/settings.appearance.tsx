import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { AmountSettings } from '@/features/amounts/amount-settings';
import { THEMES, useTheme } from '@/lib/theme';

import './settings.css';

// How the app looks: the theme and how amounts are drawn
const Appearance = () => {
    const t = useTranslations('settings');
    const { theme, setTheme } = useTheme();

    return (
        <section className="settings">
            <h1 className="settings__title">{t('appearance.title')}</h1>
            <ChoiceGroup
                legend={t('theme.title')}
                name="theme"
                options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
                value={theme}
                onChange={setTheme}
            />
            <AmountSettings />
        </section>
    );
};

export const Route = createFileRoute('/settings/appearance')({ component: Appearance });
