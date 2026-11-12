import clsx from 'clsx';
import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type ReactNode,
    type Ref,
} from 'react';

import { placeList, type ListPlacement } from './place-list';

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
    // Names the list for assistive technology: the text of the visible label
    label: string;
    options: readonly SelectOption<Value>[];
    value: Value;
    onChange: (value: Value) => void;
    // Of the field, from a `Field` around it
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    disabled?: boolean;
    // The field, for a screen that puts the focus on it
    ref?: Ref<HTMLButtonElement>;
}

// How long the letters typed on the field are remembered
const TYPING_MEMORY_MS = 500;

// A list of options with an icon beside each name if they have one, which a native select can't draw. It follows the
// select-only combobox pattern: the focus stays on the field, and the active option is the one `aria-activedescendant`
// names. It opens under the field, or over it when that is where the room is.
const Select = <Value extends string>(props: SelectProps<Value>) => {
    const {
        id,
        label,
        options,
        value,
        onChange,
        'aria-describedby': describedBy,
        'aria-invalid': invalid,
        disabled,
        ref,
    } = props;
    const listId = useId();
    const root = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const typed = useRef('');
    const typedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    // Whether the arrow keys, and not the pointer, put the active option where it is
    const [byKeys, setByKeys] = useState(false);
    // Where the list goes, measured as it opens; none while it is closed
    const [placement, setPlacement] = useState<ListPlacement | null>(null);

    const chosenIndex = Math.max(
        0,
        options.findIndex((option) => option.value === value)
    );
    const chosen = options[chosenIndex];
    const hasIcons = options.some((option) => option.icon);
    const listClsx = clsx('select__list', { 'select__list--above': placement?.above });
    const listStyle = placement ? ({ '--select-room': `${placement.room}px` } as CSSProperties) : undefined;
    const optionId = (index: number) => `${listId}-${index}`;

    useEffect(() => () => clearTimeout(typedTimer.current), []);

    // A press outside the field and its list closes the list
    useEffect(() => {
        if (!open) return;
        const close = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    // Before the list is painted, so it never shows where it doesn't fit
    useLayoutEffect(() => {
        if (!open || !root.current || !listRef.current) return;
        setPlacement(placeList(root.current, listRef.current.offsetHeight));
        return () => setPlacement(null);
    }, [open]);

    // Once the list has its place: scrolling before would move the sheet around a list that is about to move
    useEffect(() => {
        if (open && placement) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
        // optionId only depends on listId
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, placement, active]);

    const show = (index = chosenIndex) => {
        setActive(index);
        setOpen(true);
    };

    const choose = (index: number) => {
        const option = options[index];
        if (option) onChange(option.value);
        setOpen(false);
    };

    // The first name that starts with what was typed. The same letter again goes on to the next name that has it.
    const findByTyping = (letters: string, from: number): number => {
        const cycling = [...letters].every((letter) => letter === letters[0]);
        const needle = cycling ? letters.slice(0, 1) : letters;
        const start = cycling ? from + 1 : from;
        for (let step = 0; step < options.length; step++) {
            const index = (start + step) % options.length;
            if (options[index]?.label.toLowerCase().startsWith(needle)) return index;
        }
        return -1;
    };

    const type = (letter: string) => {
        typed.current += letter.toLowerCase();
        clearTimeout(typedTimer.current);
        typedTimer.current = setTimeout(() => (typed.current = ''), TYPING_MEMORY_MS);
        const found = findByTyping(typed.current, open ? active : chosenIndex);
        if (found < 0) return;
        if (open) setActive(found);
        else choose(found);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const last = options.length - 1;
        setByKeys(true);
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (open) setActive(Math.min(active + 1, last));
                else show();
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (open) setActive(Math.max(active - 1, 0));
                else show();
                break;
            case 'Home':
                event.preventDefault();
                if (open) setActive(0);
                else show(0);
                break;
            case 'End':
                event.preventDefault();
                if (open) setActive(last);
                else show(last);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (open) choose(active);
                else show();
                break;
            case 'Escape':
                if (open) {
                    event.preventDefault();
                    setOpen(false);
                }
                break;
            default:
                if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) type(event.key);
        }
    };

    const content = (option: SelectOption<Value> | undefined) => (
        <>
            {hasIcons && (option?.icon ?? <span className="select__space" aria-hidden="true" />)}
            <span className="select__text">{option?.label}</span>
        </>
    );

    return (
        <div
            className="select"
            ref={root}
            // The field is the only thing in here that takes the focus, so losing it means leaving
            onBlur={() => setOpen(false)}
        >
            <button
                ref={ref}
                className="select__field"
                id={id}
                aria-activedescendant={open ? optionId(active) : undefined}
                aria-controls={open ? listId : undefined}
                aria-describedby={describedBy}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-invalid={invalid}
                disabled={disabled}
                role="combobox"
                type="button"
                onClick={() => {
                    setByKeys(false);
                    if (open) setOpen(false);
                    else show();
                }}
                onKeyDown={handleKeyDown}
                // A Space pressed on a button clicks it when it is released, which would close what it just opened
                onKeyUp={(event) => {
                    if (event.key === ' ') event.preventDefault();
                }}
            >
                {content(chosen)}
            </button>
            {open && (
                <ul
                    className={listClsx}
                    id={listId}
                    ref={listRef}
                    style={listStyle}
                    aria-label={label}
                    role="listbox"
                    // Keeps the focus on the field while an option is pressed
                    onMouseDown={(event) => event.preventDefault()}
                >
                    {options.map((option, index) => {
                        const optionClsx = clsx('select__option', {
                            'select__option--active': index === active,
                            'select__option--keys': index === active && byKeys,
                            'select__option--chosen': index === chosenIndex,
                        });

                        return (
                            <li
                                className={optionClsx}
                                id={optionId(index)}
                                key={option.value}
                                aria-selected={index === chosenIndex}
                                role="option"
                                onClick={() => choose(index)}
                                onMouseEnter={() => {
                                    setActive(index);
                                    setByKeys(false);
                                }}
                            >
                                {content(option)}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export { Select, type SelectOption, type SelectProps };
