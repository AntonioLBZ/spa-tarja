import { useState } from 'react';

import { Field } from '@/components/field/field';
import { isCalendarDate } from '@core/date';

import './date-range-fields.css';

// The years a day can be picked in. A date field passes through 0002, 0020 and 0202 while a year is typed, and none
// of those is a day anybody means.
const FIRST_DAY = '2000-01-01';
const LAST_DAY = '2099-12-31';

type DateEdge = 'from' | 'to';

interface DateRangeFieldsProps {
    from: string;
    to: string;
    labels: Record<DateEdge, string>;
    // A whole day for the end that changed, or an empty string when `allowEmpty` lets it be cleared
    onChange: (edge: DateEdge, day: string) => void;
    allowEmpty?: boolean;
    // Both fields share the message that explains it, which the screen shows once
    invalid?: boolean;
    describedBy?: string;
}

// The From and To fields of a range of days. What doesn't make a day yet stays in the field and is not reported; leaving
// the field, or the days changing from outside, puts back the last good one.
function DateRangeFields(props: DateRangeFieldsProps) {
    const { from, to, labels, onChange, allowEmpty = false, invalid, describedBy } = props;
    const values = { from, to };
    // What a field holds while it doesn't make a day yet, so that typing in it isn't undone
    const [drafts, setDrafts] = useState<Partial<Record<DateEdge, string>>>({});
    const [seen, setSeen] = useState(values);

    if (seen.from !== from || seen.to !== to) {
        setSeen(values);
        setDrafts({});
    }

    function edit(edge: DateEdge, value: string) {
        const wholeDay = isCalendarDate(value) && value >= FIRST_DAY && value <= LAST_DAY;
        if (wholeDay || (allowEmpty && value === '')) {
            onChange(edge, value);
            setDrafts((current) => ({ ...current, [edge]: undefined }));
        } else {
            setDrafts((current) => ({ ...current, [edge]: value }));
        }
    }

    return (
        <div className="date-range-fields">
            {(['from', 'to'] as const).map((edge) => (
                <Field key={edge} label={labels[edge]} describedBy={describedBy}>
                    {(control) => (
                        <input
                            {...control}
                            aria-invalid={invalid}
                            max={LAST_DAY}
                            min={FIRST_DAY}
                            type="date"
                            value={drafts[edge] ?? values[edge]}
                            onBlur={() => setDrafts((current) => ({ ...current, [edge]: undefined }))}
                            onChange={(event) => edit(edge, event.target.value)}
                        />
                    )}
                </Field>
            ))}
        </div>
    );
}

export { DateRangeFields };
