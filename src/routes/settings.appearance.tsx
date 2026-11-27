import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Checkbox } from '@/components/checkbox/checkbox';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { AmountSettings } from '@/features/amounts/amount-settings';
import { THEMES, useTheme } from '@/lib/theme';

import './settings.css';

// How the app looks: the theme, how dark it is, and how amounts are drawn
const Appearance = () => {
    const t = useTranslations('settings');
    const { theme, setTheme, darkTone, setDarkTone } = useTheme();

    return (
        <section className="settings">
            <ScreenTitle>{t('appearance.title')}</ScreenTitle>
            <div className="settings__theme">
                <ChoiceGroup
                    legend={t('theme.title')}
                    name="theme"
                    options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
                    value={theme}
                    onChange={setTheme}
                />
                <Checkbox
                    label={t('theme.oled.label')}
                    hint={t('theme.oled.hint')}
                    checked={theme !== 'light' && darkTone === 'oled'}
                    disabled={theme === 'light'}
                    onChange={(oled) => setDarkTone(oled ? 'oled' : 'standard')}
                />
            </div>
            <AmountSettings />
        </section>
    );
};

export const Route = createFileRoute('/settings/appearance')({ component: Appearance });
