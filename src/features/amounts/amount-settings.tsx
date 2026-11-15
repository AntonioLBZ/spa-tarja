import { useTranslations } from 'use-intl';

import { Amount } from '@/components/amount/amount';
import { Checkbox } from '@/components/checkbox/checkbox';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { CURRENCY_SYMBOLS, useAmount, useAmountPreferences } from '@/lib/amounts';

import './amount-settings.css';

// How amounts show which way they go, and the symbol of the currency (ADR-0028): preferences of the device
const AmountSettings = () => {
    const t = useTranslations('settings.amounts');
    const { preferences, setPreferences } = useAmountPreferences();
    const amount = useAmount();

    return (
        <section className="amount-settings">
            <h2>{t('title')}</h2>
            <p className="hint">{t('hint')}</p>
            <p className="amount-settings__sample" aria-hidden="true">
                <Amount {...amount(2000, undefined, { cues: true, arrow: true })} />
                <Amount {...amount(-1250, undefined, { cues: true, arrow: true })} />
            </p>
            <Checkbox
                label={t('color.label')}
                hint={t('color.hint')}
                checked={preferences.color}
                onChange={(color) => setPreferences({ color })}
            />
            <Checkbox
                label={t('colorBlind.label')}
                hint={t('colorBlind.hint')}
                checked={preferences.colorBlind}
                disabled={!preferences.color}
                onChange={(colorBlind) => setPreferences({ colorBlind })}
            />
            <Checkbox
                label={t('sign.label')}
                hint={t('sign.hint')}
                checked={preferences.sign}
                onChange={(sign) => setPreferences({ sign })}
            />
            <Checkbox
                label={t('arrows.label')}
                hint={t('arrows.hint')}
                checked={preferences.arrows}
                onChange={(arrows) => setPreferences({ arrows })}
            />
            <ChoiceGroup
                legend={t('symbol.title')}
                name="currency-symbol"
                options={CURRENCY_SYMBOLS.map((value) => ({ value, label: value }))}
                value={preferences.symbol}
                onChange={(symbol) => setPreferences({ symbol })}
            />
        </section>
    );
};

export { AmountSettings };
