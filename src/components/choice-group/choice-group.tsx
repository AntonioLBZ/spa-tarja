import clsx from 'clsx';

import type { CSSProperties, ReactNode } from 'react';

import './choice-group.css';

interface ChoiceOption<Value extends string> {
    value: Value;
    // The text of the option, and its name for assistive technology when it is a swatch
    label: string;
    // What a swatch shows in place of the label
    content?: ReactNode;
}

interface ChoiceGroupProps<Value extends string> {
    legend: string;
    name: string;
    options: readonly ChoiceOption<Value>[];
    value: Value;
    // Cells that hold what they are given, like an icon, instead of a word
    swatch?: boolean;
    onChange: (value: Value) => void;
}

// A radio group drawn as a row of boxes; the checked one is filled
const ChoiceGroup = <Value extends string>(props: ChoiceGroupProps<Value>) => {
    const { legend, name, options, value, swatch, onChange } = props;
    const groupClsx = clsx('choice-group', { 'choice-group--swatch': swatch });
    const inputClsx = clsx('visually-hidden', 'choice-group__input');
    // In characters, since the font is monospace: a column has to hold the widest word whole
    const widestWord = Math.max(...options.flatMap((option) => option.label.split(/\s+/)).map((word) => word.length));
    const optionsStyle = swatch ? undefined : ({ '--choice-word': `${widestWord}ch` } as CSSProperties);

    return (
        <fieldset className={groupClsx}>
            <legend className="choice-group__legend">{legend}</legend>
            <div className="choice-group__options" style={optionsStyle}>
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="choice-group__option"
                        title={swatch ? option.label : undefined}
                    >
                        <input
                            className={inputClsx}
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={option.value === value}
                            aria-label={swatch ? option.label : undefined}
                            onChange={() => onChange(option.value)}
                        />
                        <span className="choice-group__text">
                            {swatch ? (option.content ?? option.label) : option.label}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
};

export { ChoiceGroup, type ChoiceGroupProps, type ChoiceOption };
