import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScrollStrip } from './scroll-strip';

const sizeOf = (box: HTMLElement, scrollWidth: number, clientWidth: number) => {
    Object.defineProperty(box, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: clientWidth });
};

const scrollTo = (box: HTMLElement, left: number) => {
    box.scrollLeft = left;
    fireEvent.scroll(box);
};

describe('ScrollStrip', () => {
    it('holds its things in a group the person can name', () => {
        render(
            <ScrollStrip role="group" aria-label="Categories">
                <button type="button">Food</button>
            </ScrollStrip>
        );

        const group = screen.getByRole('group', { name: 'Categories' });
        expect(group.contains(screen.getByRole('button', { name: 'Food' }))).toBe(true);
    });

    it('keeps its arrows out of the accessibility tree and the tab order', () => {
        const { container } = render(<ScrollStrip>text</ScrollStrip>);

        const arrows = container.querySelectorAll('.scroll-strip__arrow');
        expect(arrows).toHaveLength(2);
        arrows.forEach((arrow) => {
            expect(arrow.getAttribute('aria-hidden')).toBe('true');
            expect(arrow.getAttribute('tabindex')).toBe('-1');
        });
    });

    it('says which edge has more past it as it scrolls', () => {
        const { container } = render(<ScrollStrip>text</ScrollStrip>);
        const strip = container.querySelector<HTMLElement>('.scroll-strip')!;
        const track = container.querySelector<HTMLElement>('.scroll-strip__track')!;
        sizeOf(track, 600, 200);

        scrollTo(track, 0);
        expect(strip.hasAttribute('data-after')).toBe(true);
        expect(strip.hasAttribute('data-before')).toBe(false);

        scrollTo(track, 200);
        expect(strip.hasAttribute('data-after')).toBe(true);
        expect(strip.hasAttribute('data-before')).toBe(true);

        scrollTo(track, 400);
        expect(strip.hasAttribute('data-after')).toBe(false);
        expect(strip.hasAttribute('data-before')).toBe(true);
    });

    it('takes the row along by most of what is in view when an arrow is pressed', () => {
        const { container } = render(<ScrollStrip>text</ScrollStrip>);
        const track = container.querySelector<HTMLElement>('.scroll-strip__track')!;
        sizeOf(track, 600, 200);
        const scrollBy = vi.fn();
        track.scrollBy = scrollBy;

        fireEvent.click(container.querySelector('.scroll-strip__arrow--after')!);
        expect(scrollBy).toHaveBeenLastCalledWith({ left: 150, behavior: 'smooth' });

        fireEvent.click(container.querySelector('.scroll-strip__arrow--before')!);
        expect(scrollBy).toHaveBeenLastCalledWith({ left: -150, behavior: 'smooth' });
    });
});
