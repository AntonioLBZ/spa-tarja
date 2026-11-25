import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategorySelect, type CategorySelectOption } from '@/features/categories/category-select';
import { chosenOption, pickOption } from '@/lib/testing/select';

const OPTIONS: CategorySelectOption[] = [
    { id: '', label: 'All categories' },
    { id: 'food', label: 'Food', style: { color: 'vermillion', icon: 'restaurant' } },
    { id: 'gym', label: 'Gym', style: { color: 'blue', icon: 'fitness_center' } },
];

function renderSelect(props: Partial<Parameters<typeof CategorySelect>[0]> = {}) {
    return render(
        <>
            <label htmlFor="category">Category</label>
            <CategorySelect id="category" options={OPTIONS} value="food" onChange={() => {}} {...props} />
        </>
    );
}

const field = () => screen.getByRole('combobox', { name: 'Category' });

describe('CategorySelect', () => {
    it('shows the badge and the name of the chosen category', () => {
        renderSelect();

        expect(chosenOption('Category')).toBe('Food');
        expect(
            field()
                .parentElement?.querySelector('.select__icon .category-badge--vermillion [data-icon]')
                ?.getAttribute('data-icon')
        ).toBe('restaurant');
    });

    it('lists every category with its badge, and the ones with no style with the place of one', () => {
        renderSelect({ value: '' });

        const rows = within(field()).getAllByRole('option');
        expect(rows.map((row) => row.textContent)).toEqual(['All categories', 'Food', 'Gym']);
        expect(rows.map((row) => row.querySelector('[data-icon]')?.getAttribute('data-icon'))).toEqual([
            undefined,
            'restaurant',
            'fitness_center',
        ]);
        expect(rows[0]?.querySelector('.select__space')).not.toBeNull();
    });

    it('draws the icon given to an option with no style, in its row and in the field once chosen', () => {
        renderSelect({
            value: '',
            options: [
                { id: '', label: 'All categories', icon: <span data-icon="apps" /> },
                { id: 'food', label: 'Food', style: { color: 'vermillion', icon: 'restaurant' } },
            ],
        });

        const rows = within(field()).getAllByRole('option');
        expect(rows[0]?.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('apps');
        expect(field().parentElement?.querySelector('.select__icon [data-icon]')?.getAttribute('data-icon')).toBe(
            'apps'
        );
    });

    it('lists the fallback first, after the options with no style, and the rest in the order given', () => {
        renderSelect({
            value: 'other',
            options: [
                { id: '', label: 'All categories' },
                { id: 'food', label: 'Food', style: { color: 'vermillion', icon: 'restaurant' } },
                { id: 'other', label: 'Other', style: { color: 'gray', icon: 'more_horiz' } },
                { id: 'gym', label: 'Gym', style: { color: 'blue', icon: 'fitness_center' } },
            ],
        });

        const rows = within(field()).getAllByRole('option');
        expect(rows.map((row) => row.textContent)).toEqual(['All categories', 'Other', 'Food', 'Gym']);
    });

    it('answers with the id of the category that was picked', () => {
        const onChange = vi.fn();
        renderSelect({ onChange });

        pickOption('Category', 'Gym');

        expect(onChange).toHaveBeenCalledExactlyOnceWith('gym');
    });
});
