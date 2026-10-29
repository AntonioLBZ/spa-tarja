import { Button } from '@/components/button/button';

import './month-switch.css';

interface MonthSwitchProps {
    // The month as the screen says it, such as "October 2026"
    monthName: string;
    // The accessible names of the two buttons
    labels: { previous: string; next: string };
    onPrevious: () => void;
    onNext: () => void;
}

// The name of a month between the buttons that go to the one before and the one after
function MonthSwitch(props: MonthSwitchProps) {
    const { monthName, labels, onPrevious, onNext } = props;

    return (
        <div className="month-switch">
            <Button glyph aria-label={labels.previous} onClick={onPrevious}>
                ←
            </Button>
            <span className="month-switch__name">{monthName}</span>
            <Button glyph aria-label={labels.next} onClick={onNext}>
                →
            </Button>
        </div>
    );
}

export { MonthSwitch };
export type { MonthSwitchProps };
