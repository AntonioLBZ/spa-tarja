import clsx from 'clsx';
import { useId, type ReactNode } from 'react';

import { Notice } from '@/components/notice/notice';

import './field.css';

// What the control must spread on its element to be wired to the label, the hint and the error
interface FieldControl {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
}

interface FieldProps {
    label: ReactNode;
    hint?: ReactNode;
    // Shown under the control as an alert. `null` or `false` mean no problem yet, and the control says it is valid;
    // leave it out for a control that cannot be invalid.
    error?: ReactNode;
    // Ids of elements outside the field that also describe the control, such as a message shared by several fields
    describedBy?: string;
    className?: string;
    // Renders the control, or the row that holds it, which spreads `control` on the element the label points at
    children: (control: FieldControl) => ReactNode;
}

// A label, a control, and under it a hint and an error, tied together for assistive technology
function Field(props: FieldProps) {
    const { label, hint, error, describedBy, className, children } = props;
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const ids = [hint ? hintId : null, error ? errorId : null, describedBy].filter(Boolean).join(' ');

    return (
        <div className={clsx('field', className)}>
            <label htmlFor={id}>{label}</label>
            {children({
                id,
                'aria-describedby': ids || undefined,
                'aria-invalid': error === undefined ? undefined : Boolean(error),
            })}
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
}

export { Field };
export type { FieldControl, FieldProps };
