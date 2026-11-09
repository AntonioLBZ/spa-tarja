import { useId, type ReactNode } from 'react';

import { Icon } from '@/components/icon/icon';

import './checkbox.css';

interface CheckboxProps {
    label: ReactNode;
    // Under the label, like the hint of a field
    hint?: ReactNode;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}

// A square box with its label for a yes or no; the whole row is the target, and a native checkbox under the box keeps
// the keyboard, the focus and the screen reader
const Checkbox = (props: CheckboxProps) => {
    const { label, hint, checked, disabled, onChange } = props;
    const hintId = useId();

    return (
        <div className="checkbox">
            <label className="checkbox__row">
                <input
                    className="checkbox__input visually-hidden"
                    aria-describedby={hint ? hintId : undefined}
                    checked={checked}
                    disabled={disabled}
                    type="checkbox"
                    onChange={(event) => onChange(event.target.checked)}
                />
                <span className="checkbox__box">
                    <Icon name="check" />
                </span>
                <span className="checkbox__label">{label}</span>
            </label>
            {hint && (
                <p className="checkbox__hint" id={hintId}>
                    {hint}
                </p>
            )}
        </div>
    );
};

export { Checkbox, type CheckboxProps };
