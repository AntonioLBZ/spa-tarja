import clsx from 'clsx';

import type { ReactNode, Ref } from 'react';

import './select.css';

interface SelectOption<Value extends string> {
    value: Value;
    label: string;
    // Drawn before the name. The options of a list that has none keep its place, so the names line up.
    icon?: ReactNode;
}

interface SelectProps<Value extends string> {
    // Of the field, which a `<label htmlFor>` points at
    id: string;
    options: readonly SelectOption<Value>[];
    value: Value;
    onChange: (value: Value) => void;
    // Of the field, from a `Field` around it
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    disabled?: boolean;
    // The field, for a screen that puts the focus on it
    ref?: Ref<HTMLSelectElement>;
}

// A native select. Where the browser lets a select be styled, its list draws the icon of each option; elsewhere the
// list is the system's own and shows the names alone. The field shows the icon of the chosen option everywhere.
const Select = <Value extends string>(props: SelectProps<Value>) => {
    const {
        id,
        options,
        value,
        onChange,
        'aria-describedby': describedBy,
        'aria-invalid': invalid,
        disabled,
        ref,
    } = props;
    const chosen = options.find((option) => option.value === value) ?? options[0];
    const hasIcons = options.some((option) => option.icon);
    const selectClsx = clsx('select', { 'select--icons': hasIcons });

    return (
        <div className={selectClsx}>
            {hasIcons && (
                <span className="select__icon" aria-hidden="true">
                    {chosen?.icon}
                </span>
            )}
            <select
                ref={ref}
                className="select__field"
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={disabled}
                value={chosen?.value}
                onChange={(event) => onChange(event.target.value as Value)}
            >
                {options.map((option) => (
                    <option className="select__option" key={option.value} value={option.value}>
                        {hasIcons && (option.icon ?? <span className="select__space" aria-hidden="true" />)}
                        <span className="select__text">{option.label}</span>
                    </option>
                ))}
            </select>
        </div>
    );
};

export { Select, type SelectOption, type SelectProps };
