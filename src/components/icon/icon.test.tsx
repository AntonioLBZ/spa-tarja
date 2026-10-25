import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CATEGORY_ICONS } from '@core/category-style';

import { Icon } from './icon';

function draw(name: (typeof CATEGORY_ICONS)[number]) {
    const { container } = render(<Icon name={name} />);
    return container.querySelector('svg')!;
}

describe('Icon', () => {
    it.each(CATEGORY_ICONS)('draws %s', (name) => {
        const path = draw(name).querySelector('path')!;

        expect(path.getAttribute('d')).toMatch(/^[Mm][\d\s.,\-a-zA-Z]+$/);
    });

    it('draws every icon differently', () => {
        const shapes = CATEGORY_ICONS.map((name) => draw(name).querySelector('path')!.getAttribute('d'));

        expect(new Set(shapes).size).toBe(CATEGORY_ICONS.length);
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
