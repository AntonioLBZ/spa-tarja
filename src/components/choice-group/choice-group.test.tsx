import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChoiceGroup } from './choice-group';

const options = [
    { value: 'any', label: 'Any' },
    { value: 'voucher', label: 'Restaurant card' },
    { value: 'plan', label: 'Installments' },
];

const renderGroup = () => {
    render(<ChoiceGroup legend="Paid with" name="paid" options={options} value="any" onChange={() => undefined} />);

    return screen.getByRole('group', { name: 'Paid with' }).querySelector<HTMLElement>('.choice-group__options')!;
};

describe('ChoiceGroup', () => {
    it('tells its grid how wide the widest word of a label is, so a column never breaks one', () => {
        expect(renderGroup().style.getPropertyValue('--choice-word')).toBe('12ch');
    });

    it('keeps the order of its options', () => {
        renderGroup();

        expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
            'any',
            'voucher',
            'plan',
        ]);
    });
});

describe('ChoiceGroup as swatches', () => {
    const swatches = [
        { value: 'red', label: 'Red', content: <span data-glyph="red" /> },
        { value: 'blue', label: 'Blue', content: <span data-glyph="blue" /> },
    ];

    const renderSwatches = () => {
        render(
            <ChoiceGroup swatch legend="Color" name="color" options={swatches} value="red" onChange={() => undefined} />
        );

        return screen.getByRole('group', { name: 'Color' });
    };

    it('shows what each option holds in place of its label', () => {
        const group = renderSwatches();

        expect(group.querySelector('[data-glyph="red"]')).not.toBeNull();
        expect(group.querySelector('[data-glyph="blue"]')).not.toBeNull();
        expect(group.textContent).not.toContain('Blue');
    });

    it('still names each option by its label, for assistive technology and the pointer', () => {
        renderSwatches();

        const blue = screen.getByRole('radio', { name: 'Blue' });
        expect(blue.closest('label')?.getAttribute('title')).toBe('Blue');
    });

    it('leaves out the width of the words, since there are none', () => {
        const group = renderSwatches();

        expect(
            group.querySelector<HTMLElement>('.choice-group__options')!.style.getPropertyValue('--choice-word')
        ).toBe('');
        expect(group.classList.contains('choice-group--swatch')).toBe(true);
    });

    it('keeps the label as the text of an option that holds nothing', () => {
        render(
            <ChoiceGroup
                swatch
                legend="Color"
                name="color"
                options={[{ value: 'red', label: 'Red' }]}
                value="red"
                onChange={() => undefined}
            />
        );

        expect(screen.getByRole('radio', { name: 'Red' }).closest('label')?.textContent).toBe('Red');
    });
});
