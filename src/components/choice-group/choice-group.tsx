import clsx from 'clsx';
import { useRef, type CSSProperties, type ReactNode } from 'react';

import { useGlide } from '@/lib/motion/use-glide';

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

// A radio group drawn as one segmented control: a single track holds the options, and a single mark, which glides to the
// one that is checked, fills it. Swatches are cells of their own and keep a ring instead.
const ChoiceGroup = <Value extends string>(props: ChoiceGroupProps<Value>) => {
    const { legend, name, options, value, swatch, onChange } = props;
    const groupClsx = clsx('choice-group', { 'choice-group--swatch': swatch });
    const inputClsx = clsx('visually-hidden', 'choice-group__input');
    const track = useRef<HTMLDivElement>(null);
    const thumb = useRef<HTMLSpanElement>(null);
    // In characters (the width of a zero), near enough: a column has to hold the widest word whole
    const widestWord = Math.max(...options.flatMap((option) => option.label.split(/\s+/)).map((word) => word.length));
    const optionsStyle = swatch ? undefined : ({ '--choice-word': `${widestWord}ch` } as CSSProperties);

    useGlide({ track, mark: thumb, selector: '.choice-group__input:checked + .choice-group__text', follows: value });

    return (
        <fieldset className={groupClsx}>
            <legend className="choice-group__legend">{legend}</legend>
            <div ref={track} className="choice-group__options" style={optionsStyle}>
                {!swatch && <span ref={thumb} aria-hidden="true" className="choice-group__thumb" />}
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
