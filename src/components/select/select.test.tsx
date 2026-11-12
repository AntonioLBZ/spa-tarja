import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Select, type SelectOption } from './select';

const OPTIONS: SelectOption<string>[] = [
    { value: '', label: 'All categories' },
    { value: 'food', label: 'Food', icon: <span data-icon="restaurant" /> },
    { value: 'groceries', label: 'Groceries', icon: <span data-icon="shopping_cart" /> },
    { value: 'gym', label: 'Gym', icon: <span data-icon="fitness_center" /> },
];

const PLAIN: SelectOption<string>[] = [
    { value: 'direct', label: 'Direct' },
    { value: 'credit', label: 'Credit' },
];

interface HarnessProps {
    options?: readonly SelectOption<string>[];
    initial?: string;
    onChange?: (value: string) => void;
}

const Harness = (props: HarnessProps) => {
    const { options = OPTIONS, initial = 'food', onChange } = props;
    const [value, setValue] = useState(initial);

    return (
        <>
            <label htmlFor="category">Category</label>
            <Select
                id="category"
                options={options}
                value={value}
                onChange={(next) => {
                    setValue(next);
                    onChange?.(next);
                }}
            />
        </>
    );
};

const field = () => screen.getByRole('combobox', { name: 'Category' });
const chosenName = () =>
    within(field())
        .getAllByRole<HTMLOptionElement>('option')
        .find((option) => option.selected)?.textContent;
const shownIcon = () => field().parentElement?.querySelector('.select__icon');
const choose = (value: string) => fireEvent.change(field(), { target: { value } });

describe('the field', () => {
    it('is a select named by its label', () => {
        render(<Harness />);

        expect(field().tagName).toBe('SELECT');
        expect(screen.getByLabelText('Category')).toBe(field());
    });

    it('shows the chosen option', () => {
        render(<Harness />);

        expect(field()).toHaveProperty('value', 'food');
        expect(chosenName()).toBe('Food');
    });

    it('shows the first option when the value is none of them', () => {
        render(<Harness initial="long-gone" />);

        expect(chosenName()).toBe('All categories');
    });

    it('passes on what describes it and whether it is invalid, for a Field around it', () => {
        render(
            <Select
                id="category"
                options={OPTIONS}
                value="food"
                onChange={() => {}}
                aria-describedby="hint"
                aria-invalid
            />
        );

        expect(screen.getByRole('combobox').getAttribute('aria-describedby')).toBe('hint');
        expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
    });

    it('says nothing about either unless it is told', () => {
        render(<Harness />);

        expect(field().hasAttribute('aria-describedby')).toBe(false);
        expect(field().hasAttribute('aria-invalid')).toBe(false);
    });

    it('hands its field to a ref, so a screen can put the focus on it', () => {
        const ref = createRef<HTMLSelectElement>();
        render(<Select ref={ref} id="category" options={OPTIONS} value="food" onChange={() => {}} />);

        expect(ref.current).toBe(screen.getByRole('combobox'));
    });

    it('can be turned off', () => {
        render(<Select disabled id="category" options={OPTIONS} value="food" onChange={() => {}} />);

        expect(screen.getByRole('combobox')).toHaveProperty('disabled', true);
    });
});

describe('the icon beside the field', () => {
    it('is the icon of the chosen option, hidden from assistive technology', () => {
        render(<Harness />);

        expect(shownIcon()?.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('restaurant');
        expect(shownIcon()?.getAttribute('aria-hidden')).toBe('true');
    });

    it('follows the choice', () => {
        render(<Harness />);

        choose('gym');

        expect(shownIcon()?.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('fitness_center');
    });

    it('keeps its place empty for an option that has none, so the names line up', () => {
        render(<Harness initial="" />);

        expect(shownIcon()).not.toBeNull();
        expect(shownIcon()?.childElementCount).toBe(0);
        expect(field().parentElement?.classList.contains('select--icons')).toBe(true);
    });

    it('is not there when no option has one', () => {
        render(<Harness initial="direct" options={PLAIN} />);

        expect(shownIcon()).toBeNull();
        expect(field().parentElement?.classList.contains('select--icons')).toBe(false);
    });
});

describe('the options', () => {
    it('are every option, in order, each named by its label alone', () => {
        render(<Harness />);

        const options = within(field()).getAllByRole('option');

        expect(options.map((option) => option.textContent)).toEqual(['All categories', 'Food', 'Groceries', 'Gym']);
        expect(within(field()).getByRole('option', { name: 'Gym' })).toBe(options[3]);
    });

    it('carry their icon, and an option without one keeps its place', () => {
        render(<Harness />);

        const options = within(field()).getAllByRole('option');

        expect(options.map((option) => option.querySelector('[data-icon]')?.getAttribute('data-icon'))).toEqual([
            undefined,
            'restaurant',
            'shopping_cart',
            'fitness_center',
        ]);
        expect(options[0]?.querySelector('.select__space')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('leave no place for an icon when none has one', () => {
        render(<Harness initial="direct" options={PLAIN} />);

        expect(field().querySelector('.select__space')).toBeNull();
    });
});

describe('choosing', () => {
    it('hands on the value of the option chosen', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        choose('groceries');

        expect(onChange).toHaveBeenCalledExactlyOnceWith('groceries');
        expect(chosenName()).toBe('Groceries');
    });
});
