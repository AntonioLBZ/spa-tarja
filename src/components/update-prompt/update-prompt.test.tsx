import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UpdatePrompt } from './update-prompt';

const labels = { apply: 'Restart', dismiss: 'Not now' };

function renderPrompt(props: Partial<Parameters<typeof UpdatePrompt>[0]> = {}) {
    return render(
        <UpdatePrompt
            message="A fresh build is ready"
            labels={labels}
            onApply={() => undefined}
            onDismiss={() => undefined}
            {...props}
        />
    );
}

describe('UpdatePrompt', () => {
    it('says the message as a status with the two buttons', () => {
        renderPrompt();

        expect(screen.getByRole('status').textContent).toContain('A fresh build is ready');
        expect(screen.getByRole('button', { name: labels.apply })).toBeDefined();
        expect(screen.getByRole('button', { name: labels.dismiss })).toBeDefined();
    });

    it('applies the update or leaves it for later, each on its own button', () => {
        const onApply = vi.fn();
        const onDismiss = vi.fn();
        renderPrompt({ onApply, onDismiss });

        fireEvent.click(screen.getByRole('button', { name: labels.apply }));
        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onDismiss).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: labels.dismiss }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
