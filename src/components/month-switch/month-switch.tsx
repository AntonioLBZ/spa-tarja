import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';

import './month-switch.css';

interface MonthSwitchProps {
    // The month as the screen says it, such as "October 2026"
    monthName: string;
    onPrevious: () => void;
    onNext: () => void;
}

// The name of a month between the buttons that go to the one before and the one after
function MonthSwitch(props: MonthSwitchProps) {
    const { monthName, onPrevious, onNext } = props;
    const t = useTranslations('monthSwitch');

    return (
        <div className="month-switch">
            <Button glyph aria-label={t('previous')} onClick={onPrevious}>
                ←
            </Button>
            <span className="month-switch__name">{monthName}</span>
            <Button glyph aria-label={t('next')} onClick={onNext}>
                →
            </Button>
        </div>
    );
}

export { MonthSwitch };
export type { MonthSwitchProps };
