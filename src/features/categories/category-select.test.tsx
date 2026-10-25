import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategorySelect, type CategorySelectOption } from './category-select';

const OPTIONS: CategorySelectOption[] = [
    { id: '', label: 'All categories' },
    { id: 'food', label: 'Food', style: { color: 'vermillion', icon: 'restaurant' } },
    { id: 'groceries', label: 'Groceries', style: { color: 'green', icon: 'shopping_cart' } },
    { id: 'gym', label: 'Gym', style: { color: 'blue', icon: 'fitness_center' } },
];

function Harness(props: {
    options?: readonly CategorySelectOption[];
    initial?: string;
    onChange?: (id: string) => void;
}) {
    const { options = OPTIONS, initial = 'food', onChange } = props;
    const [value, setValue] = useState(initial);

    return (
        <>
            <label htmlFor="category">Category</label>
            <CategorySelect
                id="category"
                label="Category"
                options={options}
                value={value}
                onChange={(next) => {
                    setValue(next);
                    onChange?.(next);
                }}
            />
            <button type="button">Outside</button>
        </>
    );
}

const field = () => screen.getByRole('combobox', { name: 'Category' });
const list = () => screen.getByRole('listbox', { name: 'Category' });
const options = () => within(list()).getAllByRole('option');
const activeOption = () => document.getElementById(field().getAttribute('aria-activedescendant') ?? '');
const key = (name: string) => fireEvent.keyDown(field(), { key: name });
const open = () => fireEvent.click(field());

afterEach(() => {
    vi.useRealTimers();
});

describe('the field', () => {
    it('shows the icon and the name of the chosen option', () => {
        render(<Harness />);

        expect(field().textContent).toBe('Food');
        expect(field().querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('restaurant');
    });

    it('is named by its label', () => {
        render(<Harness />);

        expect(screen.getByLabelText('Category')).toBe(field());
        expect(field().getAttribute('aria-haspopup')).toBe('listbox');
    });

    it('starts closed, with no list to point at', () => {
        render(<Harness />);

        expect(field().getAttribute('aria-expanded')).toBe('false');
        expect(field().hasAttribute('aria-controls')).toBe(false);
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('shows the first option when the value is none of them', () => {
        render(<Harness initial="long-gone" />);

        expect(field().textContent).toBe('All categories');
    });

    it('shows the place of an icon when the option has none, so the names line up', () => {
        render(<Harness initial="" />);

        expect(field().querySelector('[data-icon]')).toBeNull();
        expect(field().querySelector('.category-select__space')).not.toBeNull();
    });
});

describe('the list', () => {
    it('opens under the field with every option, each with its icon and its name', () => {
        render(<Harness />);

        open();

        expect(field().getAttribute('aria-expanded')).toBe('true');
        expect(field().getAttribute('aria-controls')).toBe(list().id);
        expect(options().map((option) => option.textContent)).toEqual(['All categories', 'Food', 'Groceries', 'Gym']);
        expect(options().map((option) => option.querySelector('[data-icon]')?.getAttribute('data-icon'))).toEqual([
            undefined,
            'restaurant',
            'shopping_cart',
            'fitness_center',
        ]);
    });

    it('keeps the chosen option marked while the active one moves about', () => {
        render(<Harness initial="groceries" />);
        key('ArrowDown');
        key('ArrowDown');

        expect(activeOption()?.textContent).toBe('Gym');
        expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual([
            'false',
            'false',
            'true',
            'false',
        ]);
        expect(options().map((option) => option.classList.contains('category-select__option--chosen'))).toEqual([
            false,
            false,
            true,
            false,
        ]);
    });

    it('points at no option while it is closed', () => {
        render(<Harness />);
        expect(field().hasAttribute('aria-activedescendant')).toBe(false);

        open();
        expect(field().hasAttribute('aria-activedescendant')).toBe(true);

        open();
        expect(field().hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('listens for presses elsewhere only while the list is open', () => {
        const add = vi.spyOn(document, 'addEventListener');
        render(<Harness />);
        expect(add.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(0);

        open();

        expect(add.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(1);
        add.mockRestore();
    });

    it('marks the chosen option, and only that one', () => {
        render(<Harness initial="groceries" />);

        open();

        expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual([
            'false',
            'false',
            'true',
            'false',
        ]);
    });

    it('closes when the field is pressed again', () => {
        render(<Harness />);
        open();

        open();

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(field().getAttribute('aria-expanded')).toBe('false');
    });

    it('does not take the focus from the field when it is pressed', () => {
        render(<Harness />);
        open();

        expect(fireEvent.mouseDown(list())).toBe(false);
    });
});

describe('choosing with the pointer', () => {
    it('picks the option that was pressed, closes the list and keeps the focus on the field', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        field().focus();
        open();

        fireEvent.click(within(list()).getByRole('option', { name: 'Gym' }));

        expect(onChange).toHaveBeenCalledExactlyOnceWith('gym');
        expect(field().textContent).toBe('Gym');
        expect(field().querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('fitness_center');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(document.activeElement).toBe(field());
    });

    it('lets the same option be pressed again, which closes the list', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        open();

        fireEvent.click(within(list()).getByRole('option', { name: 'Food' }));

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(field().textContent).toBe('Food');
    });

    it('follows the pointer with the active row', () => {
        render(<Harness />);
        open();

        fireEvent.mouseEnter(within(list()).getByRole('option', { name: 'Groceries' }));

        expect(activeOption()?.textContent).toBe('Groceries');
    });

    it('closes without choosing when the person presses anywhere else', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        open();

        fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('stays open when the press is inside the list', () => {
        render(<Harness />);
        open();

        fireEvent.pointerDown(list());

        expect(screen.getByRole('listbox')).toBeDefined();
    });

    it('closes without choosing when the focus leaves the field', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        field().focus();
        open();

        act(() => screen.getByRole('button', { name: 'Outside' }).focus());

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('choosing with the keyboard', () => {
    it.each(['ArrowDown', 'ArrowUp', 'Enter', ' '])('opens the list with %j, on the chosen option', (name) => {
        render(<Harness initial="groceries" />);

        key(name);

        expect(screen.getByRole('listbox')).toBeDefined();
        expect(activeOption()?.textContent).toBe('Groceries');
    });

    it('opens the list on the first or the last option with Home and End', () => {
        render(<Harness initial="groceries" />);

        key('Home');
        expect(activeOption()?.textContent).toBe('All categories');
        key('Escape');
        key('End');
        expect(activeOption()?.textContent).toBe('Gym');
    });

    it('keeps the active option in view as it moves', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        render(<Harness />);

        key('ArrowDown');
        key('ArrowDown');

        expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
        expect(scrollIntoView.mock.contexts.at(-1)).toBe(activeOption());
        delete (Element.prototype as Partial<Element>).scrollIntoView;
    });

    it('moves the active option with the arrows, and stops at both ends', () => {
        render(<Harness initial="food" />);
        key('ArrowDown');

        key('ArrowDown');
        expect(activeOption()?.textContent).toBe('Groceries');
        key('ArrowDown');
        key('ArrowDown');
        key('ArrowDown');
        expect(activeOption()?.textContent).toBe('Gym');

        key('ArrowUp');
        expect(activeOption()?.textContent).toBe('Groceries');
        key('ArrowUp');
        key('ArrowUp');
        key('ArrowUp');
        expect(activeOption()?.textContent).toBe('All categories');
    });

    it('jumps to the first and the last option with Home and End', () => {
        render(<Harness initial="groceries" />);
        key('ArrowDown');

        key('End');
        expect(activeOption()?.textContent).toBe('Gym');
        key('Home');
        expect(activeOption()?.textContent).toBe('All categories');
    });

    it.each(['Enter', ' '])('chooses the active option with %j and closes the list', (name) => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        key('ArrowDown');
        key('ArrowDown');

        key(name);

        expect(onChange).toHaveBeenCalledExactlyOnceWith('groceries');
        expect(field().textContent).toBe('Groceries');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('takes the Escape that closes the list, so nothing else closes with it', () => {
        render(<Harness />);
        key('ArrowDown');

        expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(false);
    });

    it('leaves Escape to the page while the list is closed', () => {
        render(<Harness />);

        expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(true);
    });

    it('closes with Escape and changes nothing', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        key('ArrowDown');
        key('ArrowDown');

        key('Escape');

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(field().textContent).toBe('Food');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('starts from the chosen option again after a close', () => {
        render(<Harness />);
        key('ArrowDown');
        key('ArrowDown');
        key('Escape');

        key('ArrowDown');

        expect(activeOption()?.textContent).toBe('Food');
    });

    it('does not scroll the page with the keys it uses', () => {
        render(<Harness />);

        for (const name of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ']) {
            expect(fireEvent.keyDown(field(), { key: name })).toBe(false);
        }
    });

    it('leaves the other keys to the browser', () => {
        render(<Harness />);

        expect(fireEvent.keyDown(field(), { key: 'Tab' })).toBe(true);
        expect(fireEvent.keyDown(field(), { key: 'F5' })).toBe(true);
    });

    it('does not let a Space that was pressed on the field click it again', () => {
        render(<Harness />);

        expect(fireEvent.keyUp(field(), { key: ' ' })).toBe(false);
        expect(fireEvent.keyUp(field(), { key: 'a' })).toBe(true);
    });
});

describe('typing a name', () => {
    it('moves the active option to the first name that starts with the letters, while the list is open', () => {
        render(<Harness />);
        key('ArrowDown');

        key('g');
        expect(activeOption()?.textContent).toBe('Groceries');
        key('r');
        expect(activeOption()?.textContent).toBe('Groceries');
    });

    it('narrows down as more letters come', () => {
        render(<Harness />);
        key('ArrowDown');

        key('g');
        key('y');
        key('m');

        expect(activeOption()?.textContent).toBe('Gym');
    });

    it('goes through the names that share a first letter when it is pressed again', () => {
        render(<Harness />);
        key('ArrowDown');

        key('g');
        expect(activeOption()?.textContent).toBe('Groceries');
        key('g');
        expect(activeOption()?.textContent).toBe('Gym');
        key('g');
        expect(activeOption()?.textContent).toBe('Groceries');
    });

    it('forgets the letters after a pause', () => {
        vi.useFakeTimers();
        render(<Harness />);
        key('ArrowDown');
        key('g');
        key('y');

        act(() => vi.advanceTimersByTime(600));
        key('f');

        expect(activeOption()?.textContent).toBe('Food');
    });

    it('is not case sensitive', () => {
        render(<Harness />);
        key('ArrowDown');

        key('G');
        key('Y');

        expect(activeOption()?.textContent).toBe('Gym');
    });

    it('chooses the name straight away when the list is closed', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        key('g');

        expect(onChange).toHaveBeenCalledExactlyOnceWith('groceries');
        expect(field().textContent).toBe('Groceries');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('keeps the active option for letters no name starts with, while the list is open', () => {
        render(<Harness />);
        key('ArrowDown');
        key('ArrowDown');

        key('z');

        expect(activeOption()?.textContent).toBe('Groceries');
    });

    it('stays where it is when more letters still match the name it is on', () => {
        render(
            <Harness
                options={[
                    { id: 'food', label: 'Food' },
                    { id: 'gym', label: 'Gym' },
                    { id: 'gymnastics', label: 'Gymnastics' },
                ]}
            />
        );
        key('ArrowDown');

        key('g');
        expect(activeOption()?.textContent).toBe('Gym');
        key('y');

        expect(activeOption()?.textContent).toBe('Gym');
    });

    it('does not take the name of a key for letters', () => {
        const onChange = vi.fn();
        render(
            <Harness
                onChange={onChange}
                options={[
                    { id: 'food', label: 'Food' },
                    { id: 'shift', label: 'Shift work' },
                ]}
            />
        );

        key('Shift');

        expect(onChange).not.toHaveBeenCalled();
    });

    it('does nothing for letters no name starts with', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        key('z');

        expect(onChange).not.toHaveBeenCalled();
        expect(field().textContent).toBe('Food');
    });

    it('does not take a key that comes with Control, Alt or Meta for a letter', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        for (const modifier of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
            fireEvent.keyDown(field(), { key: 'g', ...modifier });
        }

        expect(onChange).not.toHaveBeenCalled();
    });
});
