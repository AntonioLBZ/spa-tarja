import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Actions } from '@/components/actions/actions';

describe('Actions', () => {
    it('holds its actions in one row, with the class of the call site next to its own', () => {
        render(
            <Actions className="dialog__actions">
                <button type="button">Edit</button>
                <button type="button">Delete</button>
            </Actions>
        );

        const row = screen.getByRole('button', { name: 'Edit' }).parentElement!;
        expect(row.className).toBe('actions dialog__actions');
        expect(row.children).toHaveLength(2);
    });
});
