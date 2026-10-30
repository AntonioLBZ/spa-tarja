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
