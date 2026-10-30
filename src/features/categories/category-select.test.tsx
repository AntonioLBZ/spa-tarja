import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategorySelect, type CategorySelectOption } from './category-select';

const OPTIONS: CategorySelectOption[] = [
    { id: '', label: 'All categories' },
    { id: 'food', label: 'Food', style: { color: 'vermillion', icon: 'restaurant' } },
    { id: 'gym', label: 'Gym', style: { color: 'blue', icon: 'fitness_center' } },
];

function renderSelect(props: Partial<Parameters<typeof CategorySelect>[0]> = {}) {
    return render(
        <>
            <label htmlFor="category">Category</label>
            <CategorySelect
                id="category"
                label="Category"
                options={OPTIONS}
                value="food"
                onChange={() => {}}
                {...props}
            />
        </>
    );
}

const field = () => screen.getByRole('combobox', { name: 'Category' });

describe('CategorySelect', () => {
    it('shows the badge and the name of the chosen category', () => {
        renderSelect();

        expect(field().textContent).toBe('Food');
        expect(field().querySelector('.category-badge--vermillion [data-icon]')?.getAttribute('data-icon')).toBe(
            'restaurant'
        );
    });

    it('lists every category with its badge, and the ones with no style with the place of one', () => {
        renderSelect({ value: '' });

        fireEvent.click(field());

        const rows = within(screen.getByRole('listbox', { name: 'Category' })).getAllByRole('option');
        expect(rows.map((row) => row.textContent)).toEqual(['All categories', 'Food', 'Gym']);
        expect(rows.map((row) => row.querySelector('[data-icon]')?.getAttribute('data-icon'))).toEqual([
            undefined,
            'restaurant',
            'fitness_center',
        ]);
        expect(rows[0]?.querySelector('.select__space')).not.toBeNull();
    });

    it('answers with the id of the category that was picked', () => {
        const onChange = vi.fn();
        renderSelect({ onChange });

        fireEvent.click(field());
        fireEvent.click(screen.getByRole('option', { name: 'Gym' }));

        expect(onChange).toHaveBeenCalledExactlyOnceWith('gym');
    });
});
