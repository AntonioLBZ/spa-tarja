import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Checkbox } from '@/components/checkbox/checkbox';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { AmountSettings } from '@/features/amounts/amount-settings';
import { THEMES, TYPEFACES, useTheme, useTypeface } from '@/lib/theme';

import './settings.css';

// How the app looks: the theme, how dark it is, the typeface and how amounts are drawn
const Appearance = () => {
    const t = useTranslations('settings');
    const { theme, setTheme, darkTone, setDarkTone } = useTheme();
    const [typeface, setTypeface] = useTypeface();

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
                    label={t('theme.black.label')}
                    hint={t('theme.black.hint')}
                    checked={theme !== 'light' && darkTone === 'black'}
                    disabled={theme === 'light'}
                    onChange={(black) => setDarkTone(black ? 'black' : 'standard')}
                />
            </div>
            <div className="settings__typeface">
                <ChoiceGroup
                    legend={t('typeface.title')}
                    name="typeface"
                    options={TYPEFACES.map((value) => ({ value, label: t(`typeface.${value}`) }))}
                    value={typeface}
                    onChange={setTypeface}
                />
                <p className="hint">{t('typeface.hint')}</p>
            </div>
            <AmountSettings />
        </section>
    );
};

export const Route = createFileRoute('/settings/appearance')({ component: Appearance });
