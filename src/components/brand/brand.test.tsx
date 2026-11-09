import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Brand } from './brand';

describe('Brand', () => {
    it('writes the plain name by default', () => {
        const { container } = render(<Brand />);

        expect(container.textContent).toBe('Tarja');
    });

    it.each(['header', 'hero'] as const)('adds -pre in the prerelease, at the %s size', (size) => {
        const { container } = render(<Brand size={size} prerelease />);

        expect(container.textContent).toBe('Tarja-pre');
    });
});
