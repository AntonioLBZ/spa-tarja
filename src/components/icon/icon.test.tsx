import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CATEGORY_ICONS } from '@core/category-style';

import { Icon } from './icon';
import { UI_ICONS, type IconName } from './icon-paths';

const ICON_NAMES: readonly IconName[] = [...CATEGORY_ICONS, ...UI_ICONS];

function draw(name: IconName) {
    const { container } = render(<Icon name={name} />);
    return container.querySelector('svg')!;
}

describe('Icon', () => {
    it.each(ICON_NAMES)('draws %s', (name) => {
        const path = draw(name).querySelector('path')!;

        expect(path.getAttribute('d')).toMatch(/^[Mm][\d\s.,\-a-zA-Z]+$/);
    });

    it('draws every icon differently', () => {
        const shapes = ICON_NAMES.map((name) => draw(name).querySelector('path')!.getAttribute('d'));

        expect(new Set(shapes).size).toBe(ICON_NAMES.length);
    });

    it('keeps the icons of the interface apart from the ones a category can take', () => {
        const names: readonly string[] = CATEGORY_ICONS;

        expect(UI_ICONS.length).toBeGreaterThan(0);
        expect(UI_ICONS.filter((name) => names.includes(name))).toEqual([]);
        expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    });

    it('draws the chevron of a disclosure', () => {
        expect(draw('expand_more').getAttribute('data-icon')).toBe('expand_more');
    });

    it('is decoration: the name always comes with it', () => {
        const svg = draw('restaurant');

        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.getAttribute('focusable')).toBe('false');
    });

    it('takes the color of the text around it', () => {
        expect(draw('restaurant').getAttribute('fill')).toBe('currentColor');
    });

    it('says which icon it is, for the styles and the tests', () => {
        expect(draw('home').getAttribute('data-icon')).toBe('home');
    });

    it('uses the grid the shapes were drawn on', () => {
        expect(draw('home').getAttribute('viewBox')).toBe('0 -960 960 960');
    });
});
