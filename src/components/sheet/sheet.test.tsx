import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sheet } from './sheet';

describe('Sheet', () => {
    it('names itself with its label, a heading of level 2 unless told otherwise', () => {
        render(<Sheet label="Yours">Rows</Sheet>);

        expect(screen.getByRole('heading', { level: 2, name: 'Yours' }).classList.contains('sheet__label')).toBe(true);
    });

    it('can hold its label in a heading of level 3', () => {
        render(
            <Sheet label="Monday" level="h3">
                Rows
            </Sheet>
        );

        expect(screen.getByRole('heading', { level: 3, name: 'Monday' })).toBeDefined();
    });

    it('holds what it is given after the label', () => {
        render(
            <Sheet label="Yours">
                <p>Rows</p>
            </Sheet>
        );

        const label = screen.getByRole('heading', { name: 'Yours' });
        const rows = screen.getByText('Rows');
        expect(label.parentElement).toBe(rows.parentElement);
        expect(label.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('lets the screen add classes to the sheet and to its label', () => {
        render(
            <Sheet label="Yours" className="mine" labelClassName="mine__label">
                Rows
            </Sheet>
        );

        const label = screen.getByRole('heading', { name: 'Yours' });
        expect(label.classList.contains('mine__label')).toBe(true);
        expect(label.parentElement!.classList.contains('sheet')).toBe(true);
        expect(label.parentElement!.classList.contains('mine')).toBe(true);
    });
});
