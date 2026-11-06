import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stubViewport } from '@/lib/test/viewport';

import { useWide } from './use-wide';

const Probe = () => {
    const wide = useWide();

    return <p>{wide ? 'wide' : 'narrow'}</p>;
};

describe('useWide', () => {
    it('is wide where the browser cannot answer a media query', () => {
        render(<Probe />);

        expect(screen.getByText('wide')).toBeDefined();
    });

    it('follows the screen it starts on', () => {
        stubViewport(false);
        const { unmount } = render(<Probe />);
        expect(screen.getByText('narrow')).toBeDefined();
        unmount();

        stubViewport(true);
        render(<Probe />);
        expect(screen.getByText('wide')).toBeDefined();
    });

    it('changes when the screen crosses the breakpoint', () => {
        const viewport = stubViewport(false);
        render(<Probe />);

        act(() => viewport.setWide(true));
        expect(screen.getByText('wide')).toBeDefined();

        act(() => viewport.setWide(false));
        expect(screen.getByText('narrow')).toBeDefined();
    });

    it('stops listening when it unmounts', () => {
        const viewport = stubViewport(false);
        const { unmount } = render(<Probe />);
        expect(viewport.listenerCount()).toBe(1);

        unmount();

        expect(viewport.listenerCount()).toBe(0);
    });
});
