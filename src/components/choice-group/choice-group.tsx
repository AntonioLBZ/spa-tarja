import clsx from 'clsx';

import './choice-group.css';

interface ChoiceOption<Value extends string> {
    value: Value;
    label: string;
}

interface ChoiceGroupProps<Value extends string> {
    legend: string;
    name: string;
    options: readonly ChoiceOption<Value>[];
    value: Value;
    onChange: (value: Value) => void;
}

// A radio group drawn as a row of boxes; the checked one is filled
function ChoiceGroup<Value extends string>(props: ChoiceGroupProps<Value>) {
    const { legend, name, options, value, onChange } = props;

    return (
        <fieldset className="choice-group">
            <legend className="choice-group__legend">{legend}</legend>
            <div className="choice-group__options">
                {options.map((option) => (
                    <label key={option.value} className="choice-group__option">
                        <input
                            className={clsx('visually-hidden', 'choice-group__input')}
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={option.value === value}
                            onChange={() => onChange(option.value)}
                        />
                        <span className="choice-group__text">{option.label}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export { ChoiceGroup };
export type { ChoiceOption };
