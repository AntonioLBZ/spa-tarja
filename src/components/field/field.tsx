import clsx from 'clsx';
import { useId, type ReactNode } from 'react';

import { Notice } from '@/components/notice/notice';

import './field.css';

// What the control must spread on its element to be wired to the label, the hint and the error
interface FieldControl {
    id: string;
    // Blank, so the box can tell an empty field from a filled one and keep the label in the middle while it is empty
    placeholder: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
}

interface FieldBoxProps {
    // The label, floating inside the box; a box without one holds a control named elsewhere
    label?: ReactNode;
    // Drawn at the start of the box, before the label and the text
    icon?: ReactNode;
    // Short text after what is typed, such as the unit it is in
    suffix?: ReactNode;
    children: ReactNode;
}

// The box of a field: at rest its bottom edge alone, the left one growing as it is used (ADR-0023)
const FieldBox = (props: FieldBoxProps) => {
    const { label, icon, suffix, children } = props;
    const boxClsx = clsx('field__box', {
        'field__box--labelled': label,
        'field__box--icon': icon,
        'field__box--suffix': suffix,
    });

    return (
        <div className={boxClsx}>
            {label}
            {icon && (
                <span className="field__icon" aria-hidden="true">
                    {icon}
                </span>
            )}
            {children}
            {suffix && (
                <span className="field__suffix" aria-hidden="true">
                    {suffix}
                </span>
            )}
        </div>
    );
};

interface FieldProps {
    label: ReactNode;
    hint?: ReactNode;
    // Shown under the control as an alert. `null` or `false` mean no problem yet, and the control says it is valid;
    // leave it out for a control that cannot be invalid.
    error?: ReactNode;
    // Ids of elements outside the field that also describe the control, such as a message shared by several fields
    describedBy?: string;
    icon?: ReactNode;
    suffix?: ReactNode;
    // Buttons beside the box, such as the Save of a field that is a form of its own
    actions?: ReactNode;
    className?: string;
    // Renders the control, which spreads `control` on the element the label points at
    children: (control: FieldControl) => ReactNode;
}

// A box with the label and the control, and under it a hint and an error, tied together for assistive technology
const Field = (props: FieldProps) => {
    const { label, hint, error, describedBy, icon, suffix, actions, className, children } = props;
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const ids = [hint ? hintId : null, error ? errorId : null, describedBy].filter(Boolean).join(' ');

    const fieldClsx = clsx('field', className);

    const box = (
        <FieldBox
            icon={icon}
            suffix={suffix}
            label={
                <label className="field__label" htmlFor={id}>
                    {label}
                </label>
            }
        >
            {children({
                id,
                placeholder: ' ',
                'aria-describedby': ids || undefined,
                'aria-invalid': error === undefined ? undefined : Boolean(error),
            })}
        </FieldBox>
    );

    return (
        <div className={fieldClsx}>
            {actions ? (
                <div className="field__row">
                    {box}
                    {actions}
                </div>
            ) : (
                box
            )}
            {hint && (
                <p className="field__hint" id={hintId}>
                    {hint}
                </p>
            )}
            {error && (
                <Notice tone="danger" role="alert" id={errorId}>
                    {error}
                </Notice>
            )}
        </div>
    );
};

export { Field, FieldBox, type FieldBoxProps, type FieldControl, type FieldProps };
