import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { LocaleProvider } from '@/lib/i18n';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@core/category-style';

import { StylePicker } from './style-picker';

import type { CategoryStyle } from '@core/category-style';

function show(value: CategoryStyle, onChange = vi.fn()) {
    render(
        <LocaleProvider>
            <StylePicker name="look" value={value} onChange={onChange} />
        </LocaleProvider>
    );
    return onChange;
}

const blueGym: CategoryStyle = { color: 'blue', icon: 'fitness_center' };

function group(name: string) {
    return screen.getByRole('group', { name });
}

describe('StylePicker', () => {
    it('offers every color and every icon, by name', () => {
        show(blueGym);

        const colors = within(group(en.categoryManager.look.color)).getAllByRole('radio');
        const icons = within(group(en.categoryManager.look.icon)).getAllByRole('radio');
        expect(colors.map((radio) => (radio as HTMLInputElement).value)).toEqual([...CATEGORY_COLORS]);
        expect(icons.map((radio) => (radio as HTMLInputElement).value)).toEqual([...CATEGORY_ICONS]);
        for (const color of CATEGORY_COLORS) {
            expect(screen.getByRole('radio', { name: en.categoryColors[color] })).toBeDefined();
        }
        for (const icon of CATEGORY_ICONS) {
            expect(screen.getByRole('radio', { name: en.categoryIcons[icon] })).toBeDefined();
        }
    });

    it('marks the current color and icon', () => {
        show(blueGym);

        expect((screen.getByRole('radio', { name: en.categoryColors.blue }) as HTMLInputElement).checked).toBe(true);
        expect((screen.getByRole('radio', { name: en.categoryColors.green }) as HTMLInputElement).checked).toBe(false);
        expect((screen.getByRole('radio', { name: en.categoryIcons.fitness_center }) as HTMLInputElement).checked).toBe(
            true
        );
    });

    it('reports a new color and keeps the icon', () => {
        const onChange = show(blueGym);

        fireEvent.click(screen.getByRole('radio', { name: en.categoryColors.green }));

        expect(onChange).toHaveBeenCalledWith({ color: 'green', icon: 'fitness_center' });
    });

    it('reports a new icon and keeps the color', () => {
        const onChange = show(blueGym);

        fireEvent.click(screen.getByRole('radio', { name: en.categoryIcons.spa }));

        expect(onChange).toHaveBeenCalledWith({ color: 'blue', icon: 'spa' });
    });

    it('draws the colors on the current icon and the icons in the current color', () => {
        show(blueGym);

        const colorOption = screen.getByRole('radio', { name: en.categoryColors.green }).closest('label')!;
        const iconOption = screen.getByRole('radio', { name: en.categoryIcons.spa }).closest('label')!;
        expect(colorOption.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('fitness_center');
        expect(colorOption.querySelector('.category-badge')?.className).toContain('category-badge--green');
        expect(iconOption.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('spa');
        expect(iconOption.querySelector('.category-badge')?.className).toContain('category-badge--blue');
    });

    it('lets the whole set be reached with the arrow keys of one radio group each', () => {
        show(blueGym);

        const names = new Set(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).name));

        expect(names).toEqual(new Set(['look-color', 'look-icon']));
    });
});
